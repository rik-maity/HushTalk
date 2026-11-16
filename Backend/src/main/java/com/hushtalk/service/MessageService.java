
package com.hushtalk.service;

import com.hushtalk.dto.*;
import com.hushtalk.entity.*;
import com.hushtalk.exception.ConversationNotFoundException;
import com.hushtalk.exception.UserNotFoundException;
import com.hushtalk.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ConversationMembershipRepository membershipRepository;
    private final MessageReceiptService receiptService;

    public MessageService(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            UserRepository userRepository,
            ConversationMembershipRepository membershipRepository,
            MessageReceiptService receiptService
    ) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.receiptService = receiptService;
    }

    @Transactional
    public MessageResponse createMessage(
            Long conversationId,
            MessageRequest request,
            Long userId
    ) {
        Conversation conversation =
                conversationRepository.findById(conversationId)
                        .orElseThrow(() ->
                                new ConversationNotFoundException(
                                        "Conversation not found with id: "
                                                + conversationId
                                )
                        );

        verifyMembership(conversationId, userId);

        User sender = userRepository.findById(userId)
                .orElseThrow(() ->
                        new UserNotFoundException(
                                "User not found with id: " + userId
                        )
                );

        Message message = new Message();

        message.setConversation(conversation);
        message.setSender(sender);
        message.setContent(request.getContent().trim());
        message.setCreatedAt(LocalDateTime.now());

        if (request.getReplyToMessageId() != null) {

            Message replyToMessage =
                    messageRepository.findByIdAndConversationId(
                            request.getReplyToMessageId(),
                            conversationId
                    ).orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Reply message not found in this conversation"
                            )
                    );

            message.setReplyToMessage(replyToMessage);
        }

        Message savedMessage = messageRepository.save(message);

        // Create one pending receipt for every recipient.
        receiptService.createPendingReceipts(
                savedMessage,
                userId
        );

        return toResponse(savedMessage);
    }

    @Transactional(readOnly = true)
    public Page<MessageResponse> getMessages(
            Long conversationId,
            Pageable pageable,
            Long userId
    ) {
        verifyMembership(conversationId, userId);

        return messageRepository
                .findByConversationIdOrderByCreatedAtDesc(
                        conversationId,
                        pageable
                )
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public MessagePageResponse getMessagesByCursor(
            Long conversationId,
            String cursor,
            int limit,
            Long userId
    ) {
        verifyMembership(conversationId, userId);

        if (limit < 1 || limit > 100) {
            throw new IllegalArgumentException(
                    "Limit must be between 1 and 100"
            );
        }

        Pageable pageable = PageRequest.of(0, limit + 1);

        List<Message> messages;

        if (cursor == null || cursor.isBlank()) {

            messages = messageRepository.findLatestMessages(
                    conversationId,
                    pageable
            );

        } else {

            MessageCursor decodedCursor = decodeCursor(cursor);

            messages = messageRepository.findOlderMessages(
                    conversationId,
                    decodedCursor.getCreatedAt(),
                    decodedCursor.getMessageId(),
                    pageable
            );
        }

        boolean hasMore = messages.size() > limit;

        if (hasMore) {
            messages = messages.subList(0, limit);
        }

        List<MessageResponse> responses = messages.stream()
                .map(this::toResponse)
                .toList();

        String nextCursor = null;

        if (hasMore && !messages.isEmpty()) {

            Message lastMessage = messages.get(messages.size() - 1);

            nextCursor = encodeCursor(
                    lastMessage.getCreatedAt(),
                    lastMessage.getId()
            );
        }

        return new MessagePageResponse(
                responses,
                nextCursor,
                hasMore
        );
    }

    private void verifyMembership(
            Long conversationId,
            Long userId
    ) {
        if (!conversationRepository.existsById(conversationId)) {
            throw new ConversationNotFoundException(
                    "Conversation not found with id: " + conversationId
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
    }

    private String encodeCursor(
            LocalDateTime createdAt,
            Long messageId
    ) {
        String raw = createdAt + "|" + messageId;

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        raw.getBytes(StandardCharsets.UTF_8)
                );
    }

    private MessageCursor decodeCursor(String cursor) {

        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor);

            String raw = new String(
                    decoded,
                    StandardCharsets.UTF_8
            );

            int separator = raw.lastIndexOf("|");

            if (separator <= 0) {
                throw new IllegalArgumentException("Invalid cursor");
            }

            LocalDateTime createdAt = LocalDateTime.parse(
                    raw.substring(0, separator)
            );

            Long messageId = Long.parseLong(
                    raw.substring(separator + 1)
            );

            return new MessageCursor(createdAt, messageId);

        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "Invalid cursor",
                    exception
            );
        }
    }

    private MessageResponse toResponse(Message message) {

        Message reply = message.getReplyToMessage();

        return new MessageResponse(
                message.getId(),
                message.getConversation().getId(),
                message.getSender().getId(),
                message.getContent(),
                message.getCreatedAt(),
                reply != null ? reply.getId() : null,
                reply != null ? reply.getContent() : null,
                reply != null ? reply.getSender().getId() : null
        );
    }
}
