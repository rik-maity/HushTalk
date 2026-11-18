package com.hushtalk.security;

import com.hushtalk.repository.ConversationMembershipRepository;

import io.jsonwebtoken.JwtException;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class JwtStompInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final ConversationMembershipRepository membershipRepository;

    // Existing conversation SEND destinations.
    private static final Pattern CONVERSATION_SEND_DESTINATION =
            Pattern.compile(
                    "^/app/conversations/(\\d+)/(messages|typing)$"
            );

    // Existing conversation SUBSCRIBE destinations.
    private static final Pattern CONVERSATION_SUBSCRIBE_DESTINATION =
            Pattern.compile(
                    "^/topic/conversations/(\\d+)(?:/(typing|receipts|reactions))?$"
            );

    // New call signaling SEND destinations.
    private static final Pattern CALL_SEND_DESTINATION =
            Pattern.compile(
                    "^/app/calls/(?:initiate|[0-9a-fA-F-]{36}/(?:accept|reject|end|offer|answer|ice))$"
            );

    // New private call subscription.
    private static final String CALL_SUBSCRIBE_DESTINATION =
            "/user/queue/calls";

    public JwtStompInterceptor(
            JwtService jwtService,
            ConversationMembershipRepository membershipRepository
    ) {
        this.jwtService = jwtService;
        this.membershipRepository = membershipRepository;
    }

    @Override
    public Message<?> preSend(
            Message<?> message,
            MessageChannel channel
    ) {

        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message,
                        StompHeaderAccessor.class
                );

        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();

        // =================================================
        // 1. AUTHENTICATE STOMP CONNECTION
        // =================================================

        if (StompCommand.CONNECT.equals(command)) {

            String authorizationHeader =
                    accessor.getFirstNativeHeader("Authorization");

            if (authorizationHeader == null ||
                    !authorizationHeader.startsWith("Bearer ")) {

                throw new MessageDeliveryException(
                        message,
                        "Missing or invalid Authorization header"
                );
            }

            String token = authorizationHeader.substring(7);

            try {

                Long userId = jwtService.extractUserId(token);

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userId,
                                null,
                                List.of()
                        );

                accessor.setUser(authentication);

            } catch (JwtException | IllegalArgumentException exception) {

                throw new MessageDeliveryException(
                        message,
                        "Invalid or expired JWT token"
                );
            }

            return message;
        }

        // =================================================
        // 2. AUTHORIZE SEND AND SUBSCRIBE
        // =================================================

        if (!StompCommand.SEND.equals(command) &&
                !StompCommand.SUBSCRIBE.equals(command)) {

            return message;
        }

        // Verify authenticated user.
        Principal principal = accessor.getUser();

        if (!(principal instanceof
                UsernamePasswordAuthenticationToken authentication)
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Long userId)) {

            throw new MessageDeliveryException(
                    message,
                    "Unauthenticated STOMP operation"
            );
        }

        String destination = accessor.getDestination();

        if (destination == null) {

            throw new MessageDeliveryException(
                    message,
                    "Missing STOMP destination"
            );
        }

        // =================================================
        // 3. AUTHORIZE CALL SIGNALING SEND
        // =================================================

        if (StompCommand.SEND.equals(command)) {

            if (CALL_SEND_DESTINATION.matcher(destination).matches()) {

                // Call participant and state validation happens
                // inside CallSignalingService.
                return message;
            }

            // =================================================
            // 4. AUTHORIZE EXISTING CONVERSATION SEND
            // =================================================

            Matcher matcher =
                    CONVERSATION_SEND_DESTINATION.matcher(destination);

            if (!matcher.matches()) {

                throw new MessageDeliveryException(
                        message,
                        "Unauthorized STOMP destination"
                );
            }

            Long conversationId =
                    Long.parseLong(matcher.group(1));

            validateConversationMembership(
                    message,
                    conversationId,
                    userId
            );

            return message;
        }

        // =================================================
        // 5. AUTHORIZE PRIVATE CALL SUBSCRIPTION
        // =================================================

        if (StompCommand.SUBSCRIBE.equals(command)) {

            if (CALL_SUBSCRIBE_DESTINATION.equals(destination)) {

                // Exact destination only.
                // Spring resolves this to the authenticated user's queue.
                return message;
            }

            // =================================================
            // 6. AUTHORIZE EXISTING CONVERSATION SUBSCRIPTION
            // =================================================

            Matcher matcher =
                    CONVERSATION_SUBSCRIBE_DESTINATION.matcher(destination);

            if (!matcher.matches()) {

                throw new MessageDeliveryException(
                        message,
                        "Unauthorized STOMP destination"
                );
            }

            Long conversationId =
                    Long.parseLong(matcher.group(1));

            validateConversationMembership(
                    message,
                    conversationId,
                    userId
            );
        }

        return message;
    }

    // =====================================================
    // 7. CONVERSATION MEMBERSHIP VALIDATION
    // =====================================================

    private void validateConversationMembership(
            Message<?> message,
            Long conversationId,
            Long userId
    ) {

        boolean isMember = membershipRepository
                .existsByConversationIdAndUserId(
                        conversationId,
                        userId
                );

        if (!isMember) {

            throw new MessageDeliveryException(
                    message,
                    "You are not a member of this conversation"
            );
        }
    }
}