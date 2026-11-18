package com.hushtalk.dto.call;

import java.time.Instant;

public record CallSignalEvent(

        String eventType,

        String callId,

        Long conversationId,

        Long fromUserId,

        Long toUserId,

        String callType,

        String status,

        String sdp,

        String candidate,

        String sdpMid,

        Integer sdpMLineIndex,

        Instant sentAt

) {
}