
package com.hushtalk.service;

import com.hushtalk.dto.MessageReceiptResponse;
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
public class MessageReceiptService {

    private final MessageReceiptRepository receiptRepository;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMembershipRepository membershipRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public MessageReceiptService(
            MessageReceiptRepository receiptRepository,
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            ConversationMembershipRepository membershipRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.receiptRepository = receiptRepository;
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.membershipRepository = membershipRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public void createPendingReceipts(
            Message message,
            Long senderId
    ) {
        List<ConversationMembership> members =
                membershipRepository.findByConversationId(
                        message.getConversation().getId()
                );

        LocalDateTime now = LocalDateTime.now();

        List<MessageReceipt> receipts = members.stream()
                .filter(member ->
                        !member.getUser().getId().equals(senderId)
                )
                .map(member -> {
                    MessageReceipt receipt = new MessageReceipt();

                    receipt.setMessage(message);
                    receipt.setUser(member.getUser());
                    receipt.setStatus(MessageReceiptStatus.SENT);
                    receipt.setCreatedAt(now);

                    return receipt;
                })
                .toList();

        receiptRepository.saveAll(receipts);
    }

    @Transactional
    public MessageReceiptResponse markDelivered(
            Long conversationId,
            Long messageId,
            Long userId
    ) {
        MessageReceipt receipt = getRecipientReceipt(
                conversationId,
                messageId,
                userId
        );

        boolean changed = false;

        if (receipt.getStatus() == MessageReceiptStatus.SENT) {
            receipt.setStatus(MessageReceiptStatus.DELIVERED);
            receipt.setDeliveredAt(LocalDateTime.now());
            changed = true;
        }

        MessageReceipt saved = receiptRepository.save(receipt);

        MessageReceiptResponse response = toResponse(saved);

        if (changed) {
            broadcast(conversationId, response);
        }

        return response;
    }

    @Transactional
    public MessageReceiptResponse markRead(
            Long conversationId,
            Long messageId,
            Long userId
    ) {
        MessageReceipt receipt = getRecipientReceipt(
                conversationId,
                messageId,
                userId
        );

        boolean changed = false;

        if (receipt.getStatus() != MessageReceiptStatus.READ) {

            LocalDateTime now = LocalDateTime.now();

            if (receipt.getDeliveredAt() == null) {
                receipt.setDeliveredAt(now);
            }

            receipt.setReadAt(now);
            receipt.setStatus(MessageReceiptStatus.READ);

            changed = true;
        }

        MessageReceipt saved = receiptRepository.save(receipt);

        MessageReceiptResponse response = toResponse(saved);

        if (changed) {
            broadcast(conversationId, response);
        }

        return response;
    }

    @Transactional(readOnly = true)
    public List<MessageReceiptResponse> getReceipts(
            Long conversationId,
            Long messageId,
            Long userId
    ) {
        verifyMembership(conversationId, userId);
        getMessage(conversationId, messageId);

        return receiptRepository
                .findByMessageIdOrderByUserIdAsc(messageId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private MessageReceipt getRecipientReceipt(
            Long conversationId,
            Long messageId,
            Long userId
    ) {
        verifyMembership(conversationId, userId);
        getMessage(conversationId, messageId);

        return receiptRepository
                .findByMessageIdAndUserId(messageId, userId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "No recipient receipt exists for this message"
                        )
                );
    }

    private Message getMessage(
            Long conversationId,
            Long messageId
    ) {
        return messageRepository
                .findByIdAndConversationId(messageId, conversationId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Message not found in this conversation"
                        )
                );
    }

    private void verifyMembership(
            Long conversationId,
            Long userId
    ) {
        if (!conversationRepository.existsById(conversationId)) {
            throw new ConversationNotFoundException(
                    "Conversation not found: " + conversationId
            );
        }

        if (!membershipRepository.existsByConversationIdAndUserId(
                conversationId,
                userId
        )) {
            throw new AccessDeniedException(
                    "You are not a member of this conversation"
            );
        }
    }

    private MessageReceiptResponse toResponse(
            MessageReceipt receipt
    ) {
        return new MessageReceiptResponse(
                receipt.getMessage().getId(),
                receipt.getMessage().getConversation().getId(),
                receipt.getUser().getId(),
                receipt.getStatus(),
                receipt.getDeliveredAt(),
                receipt.getReadAt()
        );
    }

    private void broadcast(
            Long conversationId,
            MessageReceiptResponse response
    ) {
        messagingTemplate.convertAndSend(
                "/topic/conversations/" + conversationId + "/receipts",
                response
        );
    }
}
