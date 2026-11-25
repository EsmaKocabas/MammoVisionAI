
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL?.includes('sslmode=') ||
      process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
  console.log('[Database] NeonDB bağlantısı başarılı.');
});

pool.on('error', (err) => {
  console.error('[Database Error]', err);
});

export const initDatabase = async (): Promise<void> => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'info'
          CHECK (type IN ('alert', 'warning', 'info', 'success')),
        link TEXT,
        related_id UUID,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_doctor_id
        ON notifications (doctor_id);

      CREATE INDEX IF NOT EXISTS idx_notifications_is_read
        ON notifications (doctor_id, is_read);

      CREATE INDEX IF NOT EXISTS idx_notifications_created
        ON notifications (created_at DESC);
    `);

    // Geriye dönük kolon uyumluluğu: xai_* -> gradcam_*
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='analyses' AND column_name='xai_heatmap_url'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='analyses' AND column_name='gradcam_heatmap_url'
        ) THEN
          ALTER TABLE analyses RENAME COLUMN xai_heatmap_url TO gradcam_heatmap_url;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='analyses' AND column_name='xai_explanation'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='analyses' AND column_name='gradcam_explanation'
        ) THEN
          ALTER TABLE analyses RENAME COLUMN xai_explanation TO gradcam_explanation;
        END IF;

        -- Kan grubu alanı uzunluğunu AB Rh+ (6 karakter) için en az 10 karaktere genişlet
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='patients' AND column_name='blood_type' AND character_maximum_length < 10
        ) THEN
          ALTER TABLE patients ALTER COLUMN blood_type TYPE VARCHAR(10);
        END IF;
      END $$;
    `);

    console.log('[Database] Tablolar kontrol edildi.');
  } catch (error) {
    console.error('[Database Init Error]:', error);
    throw error;
  }
};
