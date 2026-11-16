
package com.hushtalk.controller;

import com.hushtalk.dto.MessageRequest;
import com.hushtalk.dto.MessageResponse;
import com.hushtalk.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.validation.annotation.Validated;

import java.security.Principal;

@Controller
@Validated
public class ChatMessageController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessageController(
            MessageService messageService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.messageService = messageService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/conversations/{conversationId}/messages")
    public void sendMessage(
            @DestinationVariable Long conversationId,
            @Valid @Payload MessageRequest request,
            Principal principal
    ) {

        // Get authenticated user ID from STOMP principal
        Long userId = Long.valueOf(principal.getName());

        // Persist message using existing business logic
        MessageResponse savedMessage =
                messageService.createMessage(
                        conversationId,
                        request,
                        userId
                );

        // Broadcast only after persistence succeeds
        messagingTemplate.convertAndSend(
                "/topic/conversations/" + conversationId,
                savedMessage
        );
    }
}
