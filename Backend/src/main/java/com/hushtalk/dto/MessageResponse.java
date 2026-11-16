
package com.hushtalk.dto;

import java.time.LocalDateTime;

public class MessageResponse {

    private final Long id;
    private final Long conversationId;
    private final Long senderId;
    private final String content;
    private final LocalDateTime createdAt;

    private final Long replyToMessageId;
    private final String replyToMessageContent;
    private final Long replyToSenderId;

    public MessageResponse(
            Long id,
            Long conversationId,
            Long senderId,
            String content,
            LocalDateTime createdAt,
            Long replyToMessageId,
            String replyToMessageContent,
            Long replyToSenderId
    ) {
        this.id = id;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.content = content;
        this.createdAt = createdAt;
        this.replyToMessageId = replyToMessageId;
        this.replyToMessageContent = replyToMessageContent;
        this.replyToSenderId = replyToSenderId;
    }

    public Long getId() {
        return id;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public Long getSenderId() {
        return senderId;
    }

    public String getContent() {
        return content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public Long getReplyToMessageId() {
        return replyToMessageId;
    }

    public String getReplyToMessageContent() {
        return replyToMessageContent;
    }

    public Long getReplyToSenderId() {
        return replyToSenderId;
    }
}
