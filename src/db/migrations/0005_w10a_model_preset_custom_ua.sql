PRAGMA foreign_keys = ON;

ALTER TABLE llm_model_presets
ADD COLUMN custom_user_agent TEXT;
