
package com.hushtalk.service;

import com.hushtalk.dto.AddMemberRequest;
import com.hushtalk.dto.ChangeMemberRoleRequest;
import com.hushtalk.dto.ConversationRequest;
import com.hushtalk.dto.ConversationResponse;
import com.hushtalk.entity.Conversation;
import com.hushtalk.entity.ConversationMembership;
import com.hushtalk.entity.ConversationRole;
import com.hushtalk.entity.User;
import com.hushtalk.exception.ConversationNotFoundException;
import com.hushtalk.exception.UserNotFoundException;
import com.hushtalk.repository.ConversationCleanupRepository;
import com.hushtalk.repository.ConversationMembershipRepository;
import com.hushtalk.repository.ConversationRepository;
import com.hushtalk.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import com.hushtalk.dto.ConversationMemberResponse;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ConversationMembershipRepository membershipRepository;
    private final ConversationCleanupRepository cleanupRepository;

    public ConversationService(
            ConversationRepository conversationRepository,
            UserRepository userRepository,
            ConversationMembershipRepository membershipRepository,
            ConversationCleanupRepository cleanupRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.cleanupRepository = cleanupRepository;
    }
    @Transactional(readOnly = true)
    public List<ConversationMemberResponse> getConversationMembers(
            Long conversationId,
            Long userId
    ) {

        // Only existing conversation members can see the member list.
        requireMembership(conversationId, userId);

        return membershipRepository.findByConversationId(conversationId)
                .stream()
                .map(membership -> new ConversationMemberResponse(
                        membership.getUser().getId(),
                        membership.getUser().getUsername()
                ))
                .toList();
    }

    @Transactional
    public ConversationResponse createConversation(
            ConversationRequest request,
            Long userId
    ) {
        User user = findUser(userId);

        Conversation conversation = new Conversation();
        conversation.setName(request.getName());
        conversation.setCreatedBy(user);

        Conversation savedConversation =
                conversationRepository.save(conversation);

        ConversationMembership membership =
                new ConversationMembership();

        membership.setConversation(savedConversation);
        membership.setUser(user);
        membership.setJoinedAt(LocalDateTime.now());
        membership.setRole(ConversationRole.OWNER.name());

        membershipRepository.save(membership);

        return toResponse(savedConversation);
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getAllConversations(Long userId) {

        return membershipRepository.findByUserId(userId)
                .stream()
                .map(membership ->
                        toResponse(membership.getConversation()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversationById(
            Long conversationId,
            Long userId
    ) {
        Conversation conversation = findConversation(conversationId);

        requireMembership(conversationId, userId);

        return toResponse(conversation);
    }

    // OWNER and ADMIN can update conversation details.
    @Transactional
    public ConversationResponse updateConversation(
            Long conversationId,
            ConversationRequest request,
            Long userId
    ) {
        Conversation conversation = findConversation(conversationId);

        requireOwnerOrAdmin(conversationId, userId);

        conversation.setName(request.getName());

        return toResponse(conversation);
    }

    // OWNER and ADMIN can add members.
    // New members always enter with MEMBER role.
    @Transactional
    public void addMember(
            Long conversationId,
            AddMemberRequest request,
            Long userId
    ) {
        requireOwnerOrAdmin(conversationId, userId);

        User newUser = findUser(request.getUserId());

        if (membershipRepository.existsByConversationIdAndUserId(
                conversationId,
                newUser.getId()
        )) {
            throw new IllegalArgumentException(
                    "User is already a member of this conversation"
            );
        }

        ConversationMembership membership =
                new ConversationMembership();

        membership.setConversation(findConversation(conversationId));
        membership.setUser(newUser);
        membership.setJoinedAt(LocalDateTime.now());
        membership.setRole(ConversationRole.MEMBER.name());

        membershipRepository.save(membership);
    }

    // OWNER can remove ADMIN or MEMBER.
    // ADMIN can remove MEMBER only.
    @Transactional
    public void removeMember(
            Long conversationId,
            Long targetUserId,
            Long requesterId
    ) {
        ConversationMembership requester =
                requireMembership(conversationId, requesterId);

        ConversationMembership target =
                requireMembership(conversationId, targetUserId);

        ConversationRole requesterRole = getRole(requester);
        ConversationRole targetRole = getRole(target);

        if (requesterId.equals(targetUserId)) {
            throw new IllegalArgumentException(
                    "Use the leave conversation endpoint instead"
            );
        }

        if (requesterRole == ConversationRole.OWNER) {

            membershipRepository.delete(target);
            return;
        }

        if (requesterRole == ConversationRole.ADMIN &&
                targetRole == ConversationRole.MEMBER) {

            membershipRepository.delete(target);
            return;
        }

        throw new AccessDeniedException(
                "You do not have permission to remove this member"
        );
    }

    // Only OWNER can promote MEMBER to ADMIN or demote ADMIN to MEMBER.
    @Transactional
    public void changeMemberRole(
            Long conversationId,
            Long targetUserId,
            ChangeMemberRoleRequest request,
            Long requesterId
    ) {
        requireRole(
                conversationId,
                requesterId,
                ConversationRole.OWNER
        );

        ConversationMembership target =
                requireMembership(conversationId, targetUserId);

        ConversationRole requestedRole;

        try {
            requestedRole = ConversationRole.valueOf(
                    request.getRole().trim().toUpperCase()
            );
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "Invalid role. Allowed roles: ADMIN, MEMBER"
            );
        }

        if (requestedRole == ConversationRole.OWNER) {
            throw new IllegalArgumentException(
                    "Ownership cannot be changed through this endpoint"
            );
        }

        if (getRole(target) == ConversationRole.OWNER) {
            throw new IllegalArgumentException(
                    "The owner's role cannot be changed"
            );
        }

        target.setRole(requestedRole.name());

        membershipRepository.save(target);
    }

    // OWNER cannot leave until ownership is transferred or conversation deleted.
    @Transactional
    public void leaveConversation(
            Long conversationId,
            Long userId
    ) {
        ConversationMembership membership =
                requireMembership(conversationId, userId);

        if (getRole(membership) == ConversationRole.OWNER) {
            throw new IllegalArgumentException(
                    "Owner cannot leave. Transfer ownership or delete the conversation."
            );
        }

        membershipRepository.delete(membership);
    }

    // Only OWNER can delete a conversation.
    @Transactional
    public void deleteConversation(
            Long conversationId,
            Long userId
    ) {
        requireRole(
                conversationId,
                userId,
                ConversationRole.OWNER
        );

        Conversation conversation = findConversation(conversationId);

        cleanupRepository.clearMessageReplies(conversationId);
        cleanupRepository.deleteReactions(conversationId);
        cleanupRepository.deleteMediaMetadata(conversationId);
        cleanupRepository.deleteMessages(conversationId);
        cleanupRepository.deleteMemberships(conversationId);

        conversationRepository.delete(conversation);
    }

    private User findUser(Long userId) {

        return userRepository.findById(userId)
                .orElseThrow(() ->
                        new UserNotFoundException(
                                "User not found with id: " + userId
                        )
                );
    }

    private Conversation findConversation(Long conversationId) {

        return conversationRepository.findById(conversationId)
                .orElseThrow(() ->
                        new ConversationNotFoundException(
                                "Conversation not found with id: " + conversationId
                        )
                );
    }

    private ConversationMembership requireMembership(
            Long conversationId,
            Long userId
    ) {
        return membershipRepository
                .findByConversationIdAndUserId(
                        conversationId,
                        userId
                )
                .orElseThrow(() ->
                        new AccessDeniedException(
                                "You are not a member of this conversation"
                        )
                );
    }

    private void requireOwnerOrAdmin(
            Long conversationId,
            Long userId
    ) {
        ConversationRole role = getRole(
                requireMembership(conversationId, userId)
        );

        if (role != ConversationRole.OWNER &&
                role != ConversationRole.ADMIN) {

            throw new AccessDeniedException(
                    "Only the owner or an admin can perform this action"
            );
        }
    }

    private void requireRole(
            Long conversationId,
            Long userId,
            ConversationRole requiredRole
    ) {
        ConversationRole role = getRole(
                requireMembership(conversationId, userId)
        );

        if (role != requiredRole) {
            throw new AccessDeniedException(
                    "Only the " + requiredRole.name() +
                            " can perform this action"
            );
        }
    }

    private ConversationRole getRole(
            ConversationMembership membership
    ) {
        try {
            return ConversationRole.valueOf(
                    membership.getRole().toUpperCase()
            );
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "Invalid conversation role in database",
                    exception
            );
        }
    }

    private ConversationResponse toResponse(
            Conversation conversation
    ) {
        return new ConversationResponse(
                conversation.getId(),
                conversation.getName(),
                conversation.getCreatedBy().getId()
        );
    }
}
