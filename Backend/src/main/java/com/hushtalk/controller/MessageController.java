package com.hushtalk.controller;

import com.hushtalk.dto.MessagePageResponse;
import com.hushtalk.dto.MessageRequest;
import com.hushtalk.dto.MessageResponse;
import com.hushtalk.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/conversations")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<MessageResponse> createMessage(
            @PathVariable Long conversationId,
            @Valid @RequestBody MessageRequest request,
            @AuthenticationPrincipal Long userId
    ) {
        MessageResponse response = messageService.createMessage(
                conversationId,
                request,
                userId
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping("/{conversationId}/messages/cursor")
    public MessagePageResponse getMessagesByCursor(
            @PathVariable Long conversationId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal Long userId
    ) {
        return messageService.getMessagesByCursor(
                conversationId,
                cursor,
                limit,
                userId
        );
    }

    @GetMapping("/{conversationId}/messages")
    public Page<MessageResponse> getMessages(
            @PathVariable Long conversationId,
            Pageable pageable,
            @AuthenticationPrincipal Long userId
    ) {
        return messageService.getMessages(
                conversationId,
                pageable,
                userId
        );
    }
}