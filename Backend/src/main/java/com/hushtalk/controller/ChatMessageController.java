package com.hushtalk.controller;

import com.hushtalk.dto.MessageRequest;
import com.hushtalk.dto.MessageResponse;
import com.hushtalk.entity.ConversationMembership;
import com.hushtalk.repository.ConversationMembershipRepository;
import com.hushtalk.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.validation.annotation.Validated;

import java.security.Principal;
import java.util.List;

@Controller
@Validated
public class ChatMessageController {

    private final MessageService messageService;
    private final ConversationMembershipRepository membershipRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatMessageController(
            MessageService messageService,
            ConversationMembershipRepository membershipRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.messageService = messageService;
        this.membershipRepository = membershipRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/conversations/{conversationId}/messages")
    public void sendMessage(
            @DestinationVariable Long conversationId,
            @Valid @Payload MessageRequest request,
            Principal principal
    ) {
        Long userId = Long.valueOf(principal.getName());

        // Persist the message before publishing events.
        MessageResponse savedMessage = messageService.createMessage(
                conversationId,
                request,
                userId
        );

        // Existing channel: clients currently inside this conversation.
        messagingTemplate.convertAndSend(
                "/topic/conversations/" + conversationId,
                savedMessage
        );

        // New channel: every member's inbox, including the sender.
        List<ConversationMembership> members =
                membershipRepository.findByConversationId(conversationId);

        for (ConversationMembership member : members) {
            Long memberUserId = member.getUser().getId();

            messagingTemplate.convertAndSendToUser(
                    memberUserId.toString(),
                    "/queue/inbox",
                    savedMessage
            );
        }
    }
}