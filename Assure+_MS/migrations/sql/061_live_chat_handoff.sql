-- Shared chatbot-to-human handoff state.
--
-- The negotiation chatbot already owns chatbot.sessions/chatbot.turns and
-- chatbot.escalations. This migration keeps that ownership intact and adds the
-- small amount of queue state the Assure+ engagement centre needs.

ALTER TABLE chatbot.escalations
    ADD COLUMN IF NOT EXISTS status integer;

UPDATE chatbot.escalations SET status = 0 WHERE status IS NULL;

ALTER TABLE chatbot.escalations
    ALTER COLUMN status SET DEFAULT 0,
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE chatbot.escalations
    ADD COLUMN IF NOT EXISTS assigned_to bigint
        REFERENCES administration.app_user(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
    ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chatbot_escalation_status_ck'
          AND conrelid = 'chatbot.escalations'::regclass
    ) THEN
        ALTER TABLE chatbot.escalations
            ADD CONSTRAINT chatbot_escalation_status_ck
            CHECK (status IN (0, 1, 2));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_escalation_session
    ON chatbot.escalations(session_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_escalation_waiting
    ON chatbot.escalations(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chatbot_turn_session_index
    ON chatbot.turns(session_id, index);

CREATE INDEX IF NOT EXISTS idx_chatbot_turn_session_created
    ON chatbot.turns(session_id, created_at, id);

GRANT SELECT, INSERT, UPDATE ON chatbot.sessions, chatbot.turns, chatbot.escalations TO assure;
GRANT USAGE, SELECT ON SEQUENCE chatbot.turns_id_seq, chatbot.escalations_id_seq TO assure;
