-- ============================================================
-- 12. INACTIVIDAD DE CUENTAS Y PURGA DE EVENTOS DE SEGURIDAD
-- ============================================================
-- Agrega SOLO dos columnas nuevas a usuarios y un índice nuevo (todo con IF NOT EXISTS).
-- No cambia ni borra ninguna columna, restricción ni dato existente. Se puede ejecutar más de una vez.
--
--   ultimo_login                 Fecha del último inicio de sesión (la fija el backend en cada login).
--   aviso_inactividad_enviado    Fecha en que se envió el aviso de inactividad (NULL = sin aviso).
--                                Al volver a iniciar sesión el backend la deja en NULL: eso cancela la eliminación.
--
-- Los usuarios que ya existen reciben como "último login" el momento de ejecutar este script
-- (así nadie recibe un aviso el primer día por un login que nunca se midió).
-- HAZ UN pg_dump ANTES DE EJECUTARLO.

BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aviso_inactividad_enviado TIMESTAMP;

-- Para encontrar rápido las cuentas inactivas y las que ya tienen aviso
CREATE INDEX IF NOT EXISTS ix_usuarios_ultimo_login ON usuarios (ultimo_login);
CREATE INDEX IF NOT EXISTS ix_usuarios_aviso_inactividad ON usuarios (aviso_inactividad_enviado) WHERE aviso_inactividad_enviado IS NOT NULL;

-- Para borrar rápido los eventos de seguridad con más de 90 días
CREATE INDEX IF NOT EXISTS ix_eventos_seguridad_fecha ON eventos_seguridad (fecha);

COMMIT;

-- VERIFICACIÓN (solo lectura): debe devolver 2 filas (las dos columnas) y 3 índices.
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'usuarios' AND column_name IN ('ultimo_login', 'aviso_inactividad_enviado') ORDER BY column_name;
SELECT indexname FROM pg_indexes
 WHERE indexname IN ('ix_usuarios_ultimo_login', 'ix_usuarios_aviso_inactividad', 'ix_eventos_seguridad_fecha') ORDER BY indexname;
