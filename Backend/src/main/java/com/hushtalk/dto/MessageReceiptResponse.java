
package com.hushtalk.dto;

import com.hushtalk.entity.MessageReceiptStatus;

import java.time.LocalDateTime;

public class MessageReceiptResponse {

    private final Long messageId;
    private final Long conversationId;
    private final Long userId;
    private final MessageReceiptStatus status;
    private final LocalDateTime deliveredAt;
    private final LocalDateTime readAt;

    public MessageReceiptResponse(
            Long messageId,
            Long conversationId,
            Long userId,
            MessageReceiptStatus status,
            LocalDateTime deliveredAt,
            LocalDateTime readAt
    ) {
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.userId = userId;
        this.status = status;
        this.deliveredAt = deliveredAt;
        this.readAt = readAt;
    }

    public Long getMessageId() {
        return messageId;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public Long getUserId() {
        return userId;
    }

    public MessageReceiptStatus getStatus() {
        return status;
    }

    public LocalDateTime getDeliveredAt() {
        return deliveredAt;
    }

    public LocalDateTime getReadAt() {
        return readAt;
    }
}
