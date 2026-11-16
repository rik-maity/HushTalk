package com.hushtalk.repository;

import com.hushtalk.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ConversationRepository
        extends JpaRepository<Conversation, Long> {

    @Query("""
            SELECT c
            FROM Conversation c
            JOIN FETCH c.createdBy
            """)
    List<Conversation> findAllWithCreator();
}