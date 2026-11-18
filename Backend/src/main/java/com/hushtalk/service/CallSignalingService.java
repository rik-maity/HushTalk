package com.hushtalk.service;

import com.hushtalk.dto.call.CallInitiateRequest;
import com.hushtalk.dto.call.CallSignalEvent;
import com.hushtalk.dto.call.IceCandidateRequest;
import com.hushtalk.repository.ConversationMembershipRepository;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CallSignalingService {

    private static final String USER_CALL_QUEUE = "/queue/calls";

    private final ConversationMembershipRepository membershipRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // Stores active calls in memory.
    private final Map<UUID, CallSession> calls =
            new ConcurrentHashMap<>();

    // Tracks which call each user currently belongs to.
    private final Map<Long, UUID> activeCallByUser =
            new ConcurrentHashMap<>();

    public CallSignalingService(
            ConversationMembershipRepository membershipRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.membershipRepository = membershipRepository;
        this.messagingTemplate = messagingTemplate;
    }

    // =====================================================
    // 1. INITIATE CALL
    // =====================================================

    public synchronized void initiate(
            CallInitiateRequest request,
            Long callerId
    ) {

        Long conversationId = request.conversationId();
        Long calleeId = request.targetUserId();

        if (callerId.equals(calleeId)) {
            throw new IllegalArgumentException(
                    "You cannot call yourself"
            );
        }

        // Fetch members of the conversation.
        List<Long> memberIds = membershipRepository
                .findByConversationId(conversationId)
                .stream()
                .map(membership -> membership.getUser().getId())
                .toList();

        // Only one-to-one conversations are supported.
        if (memberIds.size() != 2 ||
                !memberIds.contains(callerId) ||
                !memberIds.contains(calleeId)) {

            throw new IllegalArgumentException(
                    "Both users must belong to the same one-to-one conversation"
            );
        }

        // Prevent either user from participating in multiple calls.
        if (activeCallByUser.containsKey(callerId) ||
                activeCallByUser.containsKey(calleeId)) {

            throw new IllegalStateException(
                    "One of the users is already in an active call"
            );
        }

        UUID callId = UUID.randomUUID();

        String callType = request.callType().toUpperCase();

        CallSession session = new CallSession(
                callId,
                conversationId,
                callerId,
                calleeId,
                callType
        );

        // Register the call.
        calls.put(callId, session);

        activeCallByUser.put(callerId, callId);
        activeCallByUser.put(calleeId, callId);

        // Notify recipient.
        send(
                calleeId,
                event(
                        "INCOMING_CALL",
                        session,
                        callerId,
                        calleeId,
                        null,
                        null,
                        null,
                        null
                )
        );

        // Notify caller that ringing has started.
        send(
                callerId,
                event(
                        "CALL_RINGING",
                        session,
                        callerId,
                        calleeId,
                        null,
                        null,
                        null,
                        null
                )
        );
    }

    // =====================================================
    // 2. ACCEPT CALL
    // =====================================================

    public synchronized void accept(
            UUID callId,
            Long userId
    ) {

        CallSession session = requireCall(callId);

        requireParticipant(session, userId);
        requireCallee(session, userId);
        requireStatus(session, CallStatus.RINGING);

        session.status = CallStatus.ACCEPTED;

        // Notify caller.
        send(
                session.callerId,
                event(
                        "CALL_ACCEPTED",
                        session,
                        userId,
                        session.callerId,
                        null,
                        null,
                        null,
                        null
                )
        );
    }

    // =====================================================
    // 3. REJECT CALL
    // =====================================================

    public synchronized void reject(
            UUID callId,
            Long userId
    ) {

        CallSession session = requireCall(callId);

        requireCallee(session, userId);
        requireStatus(session, CallStatus.RINGING);

        session.status = CallStatus.REJECTED;

        send(
                session.callerId,
                event(
                        "CALL_REJECTED",
                        session,
                        userId,
                        session.callerId,
                        null,
                        null,
                        null,
                        null
                )
        );

        removeSession(session);
    }

    // =====================================================
    // 4. END CALL
    // =====================================================

    public synchronized void end(
            UUID callId,
            Long userId
    ) {

        CallSession session = requireCall(callId);

        requireParticipant(session, userId);

        Long otherUserId = session.otherParticipant(userId);

        session.status = CallStatus.ENDED;

        send(
                otherUserId,
                event(
                        "CALL_ENDED",
                        session,
                        userId,
                        otherUserId,
                        null,
                        null,
                        null,
                        null
                )
        );

        removeSession(session);
    }

    // =====================================================
    // 5. SEND WEBRTC OFFER
    // =====================================================

    public synchronized void sendOffer(
            UUID callId,
            Long userId,
            String sdp
    ) {

        CallSession session = requireCall(callId);

        requireParticipant(session, userId);
        requireStatus(session, CallStatus.ACCEPTED);

        // Initially, only caller creates the offer.
        if (!session.callerId.equals(userId)) {
            throw new IllegalStateException(
                    "Only the caller may send the initial offer"
            );
        }

        send(
                session.calleeId,
                event(
                        "WEBRTC_OFFER",
                        session,
                        userId,
                        session.calleeId,
                        sdp,
                        null,
                        null,
                        null
                )
        );
    }

    // =====================================================
    // 6. SEND WEBRTC ANSWER
    // =====================================================

    public synchronized void sendAnswer(
            UUID callId,
            Long userId,
            String sdp
    ) {

        CallSession session = requireCall(callId);

        requireParticipant(session, userId);
        requireStatus(session, CallStatus.ACCEPTED);

        // Only callee answers the initial offer.
        if (!session.calleeId.equals(userId)) {
            throw new IllegalStateException(
                    "Only the callee may send the answer"
            );
        }

        send(
                session.callerId,
                event(
                        "WEBRTC_ANSWER",
                        session,
                        userId,
                        session.callerId,
                        sdp,
                        null,
                        null,
                        null
                )
        );
    }

    // =====================================================
    // 7. EXCHANGE ICE CANDIDATES
    // =====================================================

    public synchronized void sendIceCandidate(
            UUID callId,
            Long userId,
            IceCandidateRequest request
    ) {

        CallSession session = requireCall(callId);

        requireParticipant(session, userId);
        requireStatus(session, CallStatus.ACCEPTED);

        Long otherUserId = session.otherParticipant(userId);

        send(
                otherUserId,
                event(
                        "ICE_CANDIDATE",
                        session,
                        userId,
                        otherUserId,
                        null,
                        request.candidate(),
                        request.sdpMid(),
                        request.sdpMLineIndex()
                )
        );
    }

    // =====================================================
    // 8. VALIDATION HELPERS
    // =====================================================

    private CallSession requireCall(UUID callId) {

        CallSession session = calls.get(callId);

        if (session == null) {
            throw new IllegalArgumentException(
                    "Call does not exist or is no longer active"
            );
        }

        return session;
    }

    private void requireParticipant(
            CallSession session,
            Long userId
    ) {

        if (!session.isParticipant(userId)) {
            throw new IllegalArgumentException(
                    "You are not a participant in this call"
            );
        }
    }

    private void requireCallee(
            CallSession session,
            Long userId
    ) {

        if (!session.calleeId.equals(userId)) {
            throw new IllegalArgumentException(
                    "Only the invited user can perform this action"
            );
        }
    }

    private void requireStatus(
            CallSession session,
            CallStatus expected
    ) {

        if (session.status != expected) {
            throw new IllegalStateException(
                    "Call is not in the required state: " + expected
            );
        }
    }

    // =====================================================
    // 9. CLEANUP
    // =====================================================

    private void removeSession(CallSession session) {

        calls.remove(session.callId);

        activeCallByUser.remove(
                session.callerId,
                session.callId
        );

        activeCallByUser.remove(
                session.calleeId,
                session.callId
        );
    }

    // =====================================================
    // 10. SEND PRIVATE EVENT
    // =====================================================

    private void send(
            Long userId,
            CallSignalEvent event
    ) {

        messagingTemplate.convertAndSendToUser(
                userId.toString(),
                USER_CALL_QUEUE,
                event
        );
    }

    // =====================================================
    // 11. EVENT BUILDER
    // =====================================================

    private CallSignalEvent event(
            String eventType,
            CallSession session,
            Long fromUserId,
            Long toUserId,
            String sdp,
            String candidate,
            String sdpMid,
            Integer sdpMLineIndex
    ) {

        return new CallSignalEvent(
                eventType,
                session.callId.toString(),
                session.conversationId,
                fromUserId,
                toUserId,
                session.callType,
                session.status.name(),
                sdp,
                candidate,
                sdpMid,
                sdpMLineIndex,
                Instant.now()
        );
    }

    // =====================================================
    // 12. CALL STATE
    // =====================================================

    private enum CallStatus {
        RINGING,
        ACCEPTED,
        REJECTED,
        ENDED
    }

    // =====================================================
    // 13. CALL SESSION
    // =====================================================

    private static final class CallSession {

        private final UUID callId;
        private final Long conversationId;

        private final Long callerId;
        private final Long calleeId;

        private final String callType;

        private CallStatus status = CallStatus.RINGING;

        private CallSession(
                UUID callId,
                Long conversationId,
                Long callerId,
                Long calleeId,
                String callType
        ) {

            this.callId = callId;
            this.conversationId = conversationId;
            this.callerId = callerId;
            this.calleeId = calleeId;
            this.callType = callType;
        }

        private boolean isParticipant(Long userId) {

            return callerId.equals(userId) ||
                    calleeId.equals(userId);
        }

        private Long otherParticipant(Long userId) {

            return callerId.equals(userId)
                    ? calleeId
                    : callerId;
        }
    }
}