-- ============================================================
-- 10. COLUMNAS DE NOTIFICACIONES: Telegram y Google Calendar (opcionales)
-- ============================================================
-- SOLO AGREGA COLUMNAS (a "usuarios" y a "recordatorio"). No crea tablas, no borra ni
-- modifica columnas, tipos, restricciones ni datos existentes.

BEGIN;

-- Identificador del chat de Telegram vinculado (lo entrega Telegram cuando el usuario pulsa "Iniciar" en el bot).
-- NULL = no hay cuenta de Telegram vinculada.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- TRUE = el número de teléfono del usuario fue comprobado con Telegram (el bot recibe el contacto verificado por Telegram).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono_verificado BOOLEAN NOT NULL DEFAULT FALSE;

-- TRUE = el usuario quiere recibir recordatorios por Telegram.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telegram_activo BOOLEAN NOT NULL DEFAULT FALSE;

-- Clases de gasto de las que el usuario quiere avisos (Telegram y Google Calendar), separadas por coma.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_clases VARCHAR(60) NOT NULL DEFAULT 'vital,entretenimiento,varios';

-- Refresh token de Google, CIFRADO por la aplicación (nunca en texto plano). NULL = Google Calendar no conectado. -- CREADA - GOOGLE CALENDAR
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_refresh_token TEXT; -- CREADA - GOOGLE CALENDAR

-- Identificador del calendario "SYNCPAGO" que la aplicación creó en la cuenta de Google del usuario. -- CREADA - GOOGLE CALENDAR
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_calendario_id VARCHAR(255); -- CREADA - GOOGLE CALENDAR

-- Instante para el que ya se envió el aviso por Telegram. Si el vencimiento o la antelación cambian,
-- el instante del aviso cambia y se vuelve a avisar; si no cambia, no se repite.
ALTER TABLE recordatorio ADD COLUMN IF NOT EXISTS telegram_notificado_para TIMESTAMP;

COMMIT;

-- ------------------------------------------------------------
-- VERIFICACIÓN (solo lectura): deben aparecer las 7 columnas nuevas
-- ------------------------------------------------------------
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name = 'usuarios' AND column_name IN ('telegram_chat_id', 'telefono_verificado', 'telegram_activo', 'notif_clases', 'google_refresh_token', 'google_calendario_id'))
   OR (table_name = 'recordatorio' AND column_name = 'telegram_notificado_para')
ORDER BY table_name, ordinal_position;
