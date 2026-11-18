package com.hushtalk.controller;

import com.hushtalk.dto.call.CallInitiateRequest;
import com.hushtalk.dto.call.IceCandidateRequest;
import com.hushtalk.dto.call.SdpSignalRequest;
import com.hushtalk.service.CallSignalingService;

import jakarta.validation.Valid;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

@Controller
public class CallSignalingController {

    private final CallSignalingService callSignalingService;

    public CallSignalingController(
            CallSignalingService callSignalingService
    ) {
        this.callSignalingService = callSignalingService;
    }

    // Initiate a new call
    @MessageMapping("/calls/initiate")
    public void initiate(
            @Valid @Payload CallInitiateRequest request,
            Principal principal
    ) {
        callSignalingService.initiate(
                request,
                authenticatedUserId(principal)
        );
    }

    // Accept an incoming call
    @MessageMapping("/calls/{callId}/accept")
    public void accept(
            @DestinationVariable UUID callId,
            Principal principal
    ) {
        callSignalingService.accept(
                callId,
                authenticatedUserId(principal)
        );
    }

    // Reject an incoming call
    @MessageMapping("/calls/{callId}/reject")
    public void reject(
            @DestinationVariable UUID callId,
            Principal principal
    ) {
        callSignalingService.reject(
                callId,
                authenticatedUserId(principal)
        );
    }

    // End an active call
    @MessageMapping("/calls/{callId}/end")
    public void end(
            @DestinationVariable UUID callId,
            Principal principal
    ) {
        callSignalingService.end(
                callId,
                authenticatedUserId(principal)
        );
    }

    // Send WebRTC offer
    @MessageMapping("/calls/{callId}/offer")
    public void offer(
            @DestinationVariable UUID callId,
            @Valid @Payload SdpSignalRequest request,
            Principal principal
    ) {
        callSignalingService.sendOffer(
                callId,
                authenticatedUserId(principal),
                request.sdp()
        );
    }

    // Send WebRTC answer
    @MessageMapping("/calls/{callId}/answer")
    public void answer(
            @DestinationVariable UUID callId,
            @Valid @Payload SdpSignalRequest request,
            Principal principal
    ) {
        callSignalingService.sendAnswer(
                callId,
                authenticatedUserId(principal),
                request.sdp()
        );
    }

    // Exchange ICE candidates
    @MessageMapping("/calls/{callId}/ice")
    public void iceCandidate(
            @DestinationVariable UUID callId,
            @Valid @Payload IceCandidateRequest request,
            Principal principal
    ) {
        callSignalingService.sendIceCandidate(
                callId,
                authenticatedUserId(principal),
                request
        );
    }

    // Always derive the user ID from the authenticated principal.
    private Long authenticatedUserId(Principal principal) {

        if (principal == null) {
            throw new IllegalStateException(
                    "Missing authenticated STOMP principal"
            );
        }

        return Long.valueOf(principal.getName());
    }
}