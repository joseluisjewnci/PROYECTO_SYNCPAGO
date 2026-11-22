-- ============================================================
-- 09. COLUMNAS DE SEGURIDAD (sesión única y bloqueo de login)
-- ============================================================
-- SOLO AGREGA COLUMNAS A "usuarios". No borra ni modifica columnas, tipos,
-- restricciones ni datos existentes. Se puede ejecutar más de una vez sin problema

BEGIN;

-- Hash SHA-256 (64 caracteres hex) del identificador de la sesión activa.
-- NULL = el usuario no tiene sesión abierta. Al cerrar sesión se pone en NULL.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_id VARCHAR(64);

-- Intentos de login fallidos seguidos (vuelve a 0 con un login correcto).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos SMALLINT NOT NULL DEFAULT 0;

-- Si no es NULL y es futura, el login de ese usuario está bloqueado hasta esa hora.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP;

COMMIT;

-- ------------------------------------------------------------
-- VERIFICACIÓN (solo lectura): deben aparecer las 3 columnas nuevas
-- ------------------------------------------------------------
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('sesion_id', 'intentos_fallidos', 'bloqueado_hasta')
ORDER BY ordinal_position;
