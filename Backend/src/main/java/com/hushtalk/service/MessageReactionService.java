
package com.hushtalk.service;

import com.hushtalk.dto.ReactionEvent;
import com.hushtalk.dto.ReactionResponse;
import com.hushtalk.entity.*;
import com.hushtalk.exception.ConversationNotFoundException;
import com.hushtalk.repository.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class MessageReactionService {

    private final ReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMembershipRepository membershipRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public MessageReactionService(
            ReactionRepository reactionRepository,
            MessageRepository messageRepository,
            UserRepository userRepository,
            ConversationRepository conversationRepository,
            ConversationMembershipRepository membershipRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.reactionRepository = reactionRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
        this.membershipRepository = membershipRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public ReactionResponse addReaction(
            Long conversationId,
            Long messageId,
            String type,
            Long userId
    ) {
        Message message = getAuthorizedMessage(
                conversationId,
                messageId,
                userId
        );

        String normalizedType = type.trim();

        if (normalizedType.isEmpty() || normalizedType.length() > 30) {
            throw new IllegalArgumentException(
                    "Reaction type must contain 1 to 30 characters"
            );
        }

        var existing = reactionRepository
                .findByMessageIdAndUserIdAndType(
                        messageId,
                        userId,
                        normalizedType
                );

        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found")
                );

        Reaction reaction = new Reaction();

        reaction.setMessage(message);
        reaction.setUser(user);
        reaction.setType(normalizedType);
        reaction.setCreatedAt(LocalDateTime.now());

        Reaction saved = reactionRepository.save(reaction);

        ReactionResponse response = toResponse(saved);

        broadcast("ADDED", conversationId, response);

        return response;
    }

    @Transactional
    public void removeReaction(
            Long conversationId,
            Long messageId,
            String type,
            Long userId
    ) {
        getAuthorizedMessage(conversationId, messageId, userId);

        String normalizedType = type.trim();

        var existing = reactionRepository
                .findByMessageIdAndUserIdAndType(
                        messageId,
                        userId,
                        normalizedType
                );

        if (existing.isEmpty()) {
            return;
        }

        ReactionResponse response = toResponse(existing.get());

        reactionRepository.delete(existing.get());

        broadcast("REMOVED", conversationId, response);
    }

    @Transactional(readOnly = true)
    public List<ReactionResponse> getReactions(
            Long conversationId,
            Long messageId,
            Long userId
    ) {
        getAuthorizedMessage(conversationId, messageId, userId);

        return reactionRepository
                .findByMessageIdOrderByCreatedAtAsc(messageId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private Message getAuthorizedMessage(
            Long conversationId,
            Long messageId,
            Long userId
    ) {
        if (!conversationRepository.existsById(conversationId)) {
            throw new ConversationNotFoundException(
                    "Conversation not found: " + conversationId
            );
        }

        boolean isMember =
                membershipRepository.existsByConversationIdAndUserId(
                        conversationId,
                        userId
                );

        if (!isMember) {
            throw new AccessDeniedException(
                    "You are not a member of this conversation"
            );
        }

        return messageRepository
                .findByIdAndConversationId(messageId, conversationId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Message not found in this conversation"
                        )
                );
    }

    private ReactionResponse toResponse(Reaction reaction) {
        return new ReactionResponse(
                reaction.getId(),
                reaction.getMessage().getConversation().getId(),
                reaction.getMessage().getId(),
                reaction.getUser().getId(),
                reaction.getType(),
                reaction.getCreatedAt()
        );
    }

    private void broadcast(
            String action,
            Long conversationId,
            ReactionResponse response
    ) {
        messagingTemplate.convertAndSend(
                "/topic/conversations/" + conversationId + "/reactions",
                new ReactionEvent(action, response)
        );
    }
}
