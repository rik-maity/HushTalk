
package com.hushtalk.repository;

import com.hushtalk.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MessageRepository
        extends JpaRepository<Message, Long> {

    Page<Message> findByConversationIdOrderByCreatedAtDesc(
            Long conversationId,
            Pageable pageable
    );

    Optional<Message> findByIdAndConversationId(
            Long messageId,
            Long conversationId
    );

    @Query("""
            SELECT m
            FROM Message m
            JOIN FETCH m.conversation
            JOIN FETCH m.sender
            LEFT JOIN FETCH m.replyToMessage
            WHERE m.conversation.id = :conversationId
            ORDER BY m.createdAt DESC, m.id DESC
            """)
    List<Message> findLatestMessages(
            @Param("conversationId") Long conversationId,
            Pageable pageable
    );

    @Query("""
            SELECT m
            FROM Message m
            JOIN FETCH m.conversation
            JOIN FETCH m.sender
            LEFT JOIN FETCH m.replyToMessage
            WHERE m.conversation.id = :conversationId
            AND (
                m.createdAt < :createdAt
                OR (
                    m.createdAt = :createdAt
                    AND m.id < :messageId
                )
            )
            ORDER BY m.createdAt DESC, m.id DESC
            """)
    List<Message> findOlderMessages(
            @Param("conversationId") Long conversationId,
            @Param("createdAt") LocalDateTime createdAt,
            @Param("messageId") Long messageId,
            Pageable pageable
    );
}
