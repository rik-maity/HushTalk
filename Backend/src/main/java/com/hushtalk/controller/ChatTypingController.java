
package com.hushtalk.controller;

import com.hushtalk.dto.TypingEvent;
import com.hushtalk.dto.TypingRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

@Controller
public class ChatTypingController {

    private final SimpMessagingTemplate messagingTemplate;

    public ChatTypingController(
            SimpMessagingTemplate messagingTemplate
    ) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/conversations/{conversationId}/typing")
    public void handleTyping(
            @DestinationVariable Long conversationId,
            @Payload TypingRequest request,
            Principal principal
    ) {
        Long userId = Long.valueOf(principal.getName());

        TypingEvent event = new TypingEvent(
                conversationId,
                userId,
                request.isTyping(),
                Instant.now()
        );

        messagingTemplate.convertAndSend(
                "/topic/conversations/" + conversationId + "/typing",
                event
        );
    }
}
