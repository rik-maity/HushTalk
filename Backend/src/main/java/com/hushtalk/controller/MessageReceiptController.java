
package com.hushtalk.controller;

import com.hushtalk.dto.MessageReceiptResponse;
import com.hushtalk.service.MessageReceiptService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/conversations")
public class MessageReceiptController {

    private final MessageReceiptService receiptService;

    public MessageReceiptController(
            MessageReceiptService receiptService
    ) {
        this.receiptService = receiptService;
    }

    @PostMapping("/{conversationId}/messages/{messageId}/delivered")
    public MessageReceiptResponse markDelivered(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @AuthenticationPrincipal Long userId
    ) {
        return receiptService.markDelivered(
                conversationId,
                messageId,
                userId
        );
    }

    @PostMapping("/{conversationId}/messages/{messageId}/read")
    public MessageReceiptResponse markRead(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @AuthenticationPrincipal Long userId
    ) {
        return receiptService.markRead(
                conversationId,
                messageId,
                userId
        );
    }

    @GetMapping("/{conversationId}/messages/{messageId}/receipts")
    public List<MessageReceiptResponse> getReceipts(
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @AuthenticationPrincipal Long userId
    ) {
        return receiptService.getReceipts(
                conversationId,
                messageId,
                userId
        );
    }
}
