
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

    private static final Pattern SEND_DESTINATION =
            Pattern.compile(
                    "^/app/conversations/(\\d+)/(messages|typing)$"
            );

    private static final Pattern SUBSCRIBE_DESTINATION =
            Pattern.compile(
                    "^/topic/conversations/(\\d+)(?:/(typing|receipts|reactions))?$"
            );

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

        // Authenticate the STOMP connection.
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

        // Authorize SEND and SUBSCRIBE operations.
        if (StompCommand.SEND.equals(command) ||
                StompCommand.SUBSCRIBE.equals(command)) {

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

            Pattern pattern = StompCommand.SEND.equals(command)
                    ? SEND_DESTINATION
                    : SUBSCRIBE_DESTINATION;

            Matcher matcher = destination == null
                    ? null
                    : pattern.matcher(destination);

            if (matcher == null || !matcher.matches()) {
                throw new MessageDeliveryException(
                        message,
                        "Unauthorized STOMP destination"
                );
            }

            Long conversationId = Long.parseLong(matcher.group(1));

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

        return message;
    }
}
