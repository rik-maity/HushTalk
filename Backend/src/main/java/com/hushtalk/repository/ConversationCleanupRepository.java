
package com.hushtalk.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface ConversationCleanupRepository
        extends Repository<com.hushtalk.entity.Conversation, Long> {

    @Modifying
    @Query(
            value = """
                    UPDATE messages
                    SET reply_to_message_id = NULL
                    WHERE conversation_id = :conversationId
                    """,
            nativeQuery = true
    )
    void clearMessageReplies(
            @Param("conversationId") Long conversationId
    );

    @Modifying
    @Query(
            value = """
                    DELETE FROM reactions
                    WHERE message_id IN (
                        SELECT id FROM messages
                        WHERE conversation_id = :conversationId
                    )
                    """,
            nativeQuery = true
    )
    void deleteReactions(
            @Param("conversationId") Long conversationId
    );

    @Modifying
    @Query(
            value = """
                    DELETE FROM media_metadata
                    WHERE message_id IN (
                        SELECT id FROM messages
                        WHERE conversation_id = :conversationId
                    )
                    """,
            nativeQuery = true
    )
    void deleteMediaMetadata(
            @Param("conversationId") Long conversationId
    );

    @Modifying
    @Query(
            value = """
                    DELETE FROM messages
                    WHERE conversation_id = :conversationId
                    """,
            nativeQuery = true
    )
    void deleteMessages(
            @Param("conversationId") Long conversationId
    );

    @Modifying
    @Query(
            value = """
                    DELETE FROM conversation_memberships
                    WHERE conversation_id = :conversationId
                    """,
            nativeQuery = true
    )
    void deleteMemberships(
            @Param("conversationId") Long conversationId
    );
}
