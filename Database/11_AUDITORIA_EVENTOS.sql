-- ============================================================
-- 11. AUDITORÍA DE EVENTOS DE SEGURIDAD (tabla nueva: eventos_seguridad)
-- ============================================================
-- SOLO esta tabla nueva (CREATE TABLE IF NOT EXISTS).
-- No toca ninguna tabla, columna, tipo, restricción ni dato existente. Se puede ejecutar más de una vez.
-- Qué guarda: quién (id_usuario o el correo que se intentó), qué pasó (tipo), si salió bien (exito),
-- una nota corta (detalle), desde qué IP y cuándo. NUNCA guarda contraseñas, códigos ni tokens.
-- id_usuario NO tiene llave foránea a propósito: la historia debe sobrevivir aunque se borre el usuario.

BEGIN;

CREATE TABLE IF NOT EXISTS eventos_seguridad (
    id_evento   BIGSERIAL PRIMARY KEY,
    id_usuario  INTEGER,
    correo      VARCHAR(255),
    tipo        VARCHAR(40) NOT NULL,
    exito       BOOLEAN NOT NULL DEFAULT TRUE,
    detalle     VARCHAR(200),
    ip          VARCHAR(45),
    fecha       TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP
);

-- Para listar rápido la actividad de un usuario (la más reciente primero)
CREATE INDEX IF NOT EXISTS ix_eventos_seguridad_usuario_fecha ON eventos_seguridad (id_usuario, fecha DESC);

COMMIT;

-- VERIFICACIÓN (solo lectura): debe devolver 1 fila (la tabla) y 8 columnas.
SELECT table_name FROM information_schema.tables WHERE table_name = 'eventos_seguridad';
SELECT column_name FROM information_schema.columns WHERE table_name = 'eventos_seguridad' ORDER BY ordinal_position;