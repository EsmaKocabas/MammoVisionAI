
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
import { UPLOADS_DIR } from '../config/paths.js';

const require = createRequire(import.meta.url);

// Türkçe karakter destekli DejaVu Sans fontları
const fontRegular = require.resolve(
  'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'
);

const fontBold = require.resolve(
  'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'
);

interface ReportData {
  analysis: {
    id: string;
    protocol_no: string;
    status: string;
    malignancy_probability: string | number | null;
    risk_level: string | null;
    classification_label: string | null;
    model_confidence: string | number | null;
    classification_model: string | null;
    model_version: string | null;
    gradcam_heatmap_url?: string | null;
    gradcam_explanation?: string | null;
    doctor_notes: string | null;
    final_decision: string | null;
    is_reviewed: boolean;
    reviewed_at: string | Date | null;
    requested_at: string | Date | null;
    completed_at: string | Date | null;
    patient: {
      id: string;
      tc_no: string;
      first_name: string;
      last_name: string;
      date_of_birth?: string;
      gender?: string;
      phone?: string;
    };
    image: {
      id: string;
      url: string;
      original_filename: string;
      laterality?: string | null;
      view_position?: string | null;
      acquisition_date?: string | null;
    };
  };
  doctor: {
    full_name: string;
    title?: string | null;
    specialty?: string | null;
    hospital?: string | null;
  };
}

export const generateAnalysisPdfBuffer = async (
  data: ReportData
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `MammoVisionAI Raporu - ${data.analysis.protocol_no}`,
        Author: 'MammoVisionAI AI Sistemi',
        Subject: 'Mamografi Analiz ve Karar Destek Raporu',
      },
    });

    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err: Error) => reject(err));

    const { analysis, doctor } = data;
    const patient = analysis.patient;
    const image = analysis.image;

    // ─── Header & Logo ───
    doc.rect(40, 40, 515, 55).fill('#0f172a');

    doc
      .fillColor('#ffffff')
      .font(fontBold)
      .fontSize(18)
      .text('MAMMOVISIONAI', 55, 52);

    doc
      .font(fontRegular)
      .fontSize(9)
      .fillColor('#94a3b8')
      .text(
        'Yapay Zeka Destekli Mamografi Analiz ve Grad-CAM++ Raporu',
        55,
        74
      );

    doc
      .font(fontBold)
      .fontSize(10)
      .fillColor('#38bdf8')
      .text(`Protokol: ${analysis.protocol_no}`, 370, 52, {
        align: 'right',
        width: 170,
      });

    const reportDate = analysis.completed_at
      ? new Date(analysis.completed_at).toLocaleDateString('tr-TR')
      : new Date().toLocaleDateString('tr-TR');

    doc
      .font(fontRegular)
      .fontSize(8)
      .fillColor('#cbd5e1')
      .text(`Rapor Tarihi: ${reportDate}`, 370, 72, {
        align: 'right',
        width: 170,
      });

    let currentY = 110;

    // ─── Hasta ve Hekim Bilgileri ───
    const boxWidth = 250;
    const boxHeight = 85;

    // Hasta Bilgileri
    doc
      .roundedRect(40, currentY, boxWidth, boxHeight, 6)
      .lineWidth(1)
      .stroke('#e2e8f0');

    doc.rect(40, currentY, boxWidth, 22).fill('#f1f5f9');

    doc
      .fillColor('#1e293b')
      .font(fontBold)
      .fontSize(10)
      .text('HASTA BİLGİLERİ', 50, currentY + 6);

    doc
      .font(fontRegular)
      .fontSize(9)
      .fillColor('#334155');

    doc.text(
      `Adı Soyadı: ${patient.first_name} ${patient.last_name}`,
      50,
      currentY + 28
    );

    doc.text(
      `TC Kimlik No: ${patient.tc_no}`,
      50,
      currentY + 44
    );

    const dob = patient.date_of_birth
      ? new Date(patient.date_of_birth).toLocaleDateString('tr-TR')
      : '-';

    doc.text(
      `Doğum Tarihi: ${dob}  |  Cinsiyet: ${patient.gender ?? 'Kadın'}`,
      50,
      currentY + 60
    );

    // Hekim ve Kurum Bilgileri
    const rightBoxX = 305;

    doc
      .roundedRect(rightBoxX, currentY, boxWidth, boxHeight, 6)
      .lineWidth(1)
      .stroke('#e2e8f0');

    doc.rect(rightBoxX, currentY, boxWidth, 22).fill('#f1f5f9');

    doc
      .fillColor('#1e293b')
      .font(fontBold)
      .fontSize(10)
      .text('SORUMLU HEKİM & KURUM', rightBoxX + 10, currentY + 6);

    doc
      .font(fontRegular)
      .fontSize(9)
      .fillColor('#334155');

    const doctorTitle = [doctor.title, doctor.full_name]
      .filter(Boolean)
      .join(' ');

    doc.text(
      `Hekim: ${doctorTitle}`,
      rightBoxX + 10,
      currentY + 28
    );

    doc.text(
      `Uzmanlık: ${doctor.specialty || 'Radyoloji / Genel Cerrahi'}`,
      rightBoxX + 10,
      currentY + 44
    );

    doc.text(
      `Hastane: ${doctor.hospital || 'MammoVisionAI Tıp Merkezi'}`,
      rightBoxX + 10,
      currentY + 60
    );

    currentY += 100;

    // ─── AI Model Analiz Sonuçları ───
    doc
      .roundedRect(40, currentY, 515, 105, 6)
      .lineWidth(1)
      .stroke('#cbd5e1');

    doc.rect(40, currentY, 515, 24).fill('#0284c7');

    doc
      .fillColor('#ffffff')
      .font(fontBold)
      .fontSize(10)
      .text('YAPAY ZEKA (AI) ANALİZ BULGULARI', 50, currentY + 7);

    const risk = analysis.risk_level || 'Belirtilmedi';

    let riskBg = '#22c55e';

    if (risk.includes('Yüksek')) {
      riskBg = '#ef4444';
    } else if (
      risk.includes('İnceleniyor') ||
      risk.includes('Orta')
    ) {
      riskBg = '#f59e0b';
    }

    doc
      .roundedRect(400, currentY + 34, 140, 32, 4)
      .fill(riskBg);

    doc
      .fillColor('#ffffff')
      .font(fontBold)
      .fontSize(11)
      .text(risk.toLocaleUpperCase('tr-TR'), 400, currentY + 44, {
        align: 'center',
        width: 140,
      });

    doc
      .fillColor('#0f172a')
      .font(fontBold)
      .fontSize(9);

    doc.text(
      'Sınıflandırma Teşhisi:',
      55,
      currentY + 36
    );

    doc
      .font(fontRegular)
      .text(
        analysis.classification_label || 'Normal / Malign bulgu yok',
        180,
        currentY + 36,
        { width: 205, lineBreak: false }
      );

    doc
      .font(fontBold)
      .text('Malignite Olasılığı:', 55, currentY + 52);

    const prob =
      analysis.malignancy_probability !== null &&
        analysis.malignancy_probability !== undefined
        ? `%${(
          Number(analysis.malignancy_probability) * 100
        ).toFixed(1)}`
        : '-';

    doc
      .font(fontRegular)
      .text(prob, 180, currentY + 52);

    doc
      .font(fontBold)
      .text('Model Güven Skoru:', 55, currentY + 68);

    const conf =
      analysis.model_confidence !== null &&
        analysis.model_confidence !== undefined
        ? `%${(
          Number(analysis.model_confidence) * 100
        ).toFixed(1)}`
        : '-';

    doc
      .font(fontRegular)
      .text(conf, 180, currentY + 68);

    // Model satırı diğer bilgilerle aynı hizada
    doc
      .font(fontBold)
      .fontSize(9)
      .text('Model / Yöntem:', 55, currentY + 84);

    doc
      .font(fontRegular)
      .fontSize(9)
      .text(
        `${analysis.classification_model || 'EfficientNet-B4'} | Grad-CAM++ Isı Haritası`,
        180,
        currentY + 84,
        {
          width: 365,
          lineBreak: false,
        }
      );

    currentY += 120;

    // ─── Görüntüler ───
    doc
      .font(fontBold)
      .fontSize(10)
      .fillColor('#0f172a')
      .text(
        'GÖRSEL İNCELEME & GRAD-CAM++ ISI HARİTASI',
        40,
        currentY
      );

    currentY += 16;

    const imgWidth = 245;
    const imgHeight = 160;

    // Orijinal Mamografi
    let mammoRendered = false;

    if (image?.url) {
      const relativePath = image.url.replace(/^\/uploads\//, '');
      const fullPath = path.join(UPLOADS_DIR, relativePath);

      if (fs.existsSync(fullPath)) {
        try {
          doc.image(fullPath, 40, currentY, {
            fit: [imgWidth, imgHeight],
            align: 'center',
            valign: 'center',
          });

          mammoRendered = true;
        } catch {
          // Görüntü okunamazsa yedek kutu gösterilir.
        }
      }
    }

    if (!mammoRendered) {
      doc
        .roundedRect(40, currentY, imgWidth, imgHeight, 4)
        .lineWidth(1)
        .stroke('#e2e8f0');

      doc
        .fillColor('#94a3b8')
        .font(fontRegular)
        .fontSize(9)
        .text('Mamografi Görüntüsü', 40, currentY + 70, {
          align: 'center',
          width: imgWidth,
        });
    }

    doc
      .fillColor('#475569')
      .font(fontRegular)
      .fontSize(8)
      .text(
        'Orijinal Mamografi Görüntüsü',
        40,
        currentY + imgHeight + 4,
        {
          align: 'center',
          width: imgWidth,
        }
      );

    // Grad-CAM++ Isı Haritası
    let heatmapRendered = false;

    const heatmapUrl = analysis.gradcam_heatmap_url;

    if (heatmapUrl) {
      const relativePath = heatmapUrl.replace(/^\/uploads\//, '');
      const fullPath = path.join(UPLOADS_DIR, relativePath);

      if (fs.existsSync(fullPath)) {
        try {
          doc.image(fullPath, 310, currentY, {
            fit: [imgWidth, imgHeight],
            align: 'center',
            valign: 'center',
          });

          heatmapRendered = true;
        } catch {
          // Isı haritası okunamazsa yedek kutu gösterilir.
        }
      }
    }

    if (!heatmapRendered) {
      doc
        .roundedRect(310, currentY, imgWidth, imgHeight, 4)
        .lineWidth(1)
        .stroke('#e2e8f0');

      doc
        .fillColor('#94a3b8')
        .font(fontRegular)
        .fontSize(9)
        .text('Grad-CAM++ Isı Haritası', 310, currentY + 70, {
          align: 'center',
          width: imgWidth,
        });
    }

    doc
      .fillColor('#475569')
      .font(fontRegular)
      .fontSize(8)
      .text(
        'Grad-CAM++ Odak Haritası',
        310,
        currentY + imgHeight + 4,
        {
          align: 'center',
          width: imgWidth,
        }
      );

    currentY += imgHeight + 25;

    // ─── Hekimin Klinik Değerlendirmesi ───
    const clinicalHeight = 112;

    doc
      .roundedRect(40, currentY, 515, clinicalHeight, 6)
      .lineWidth(1)
      .stroke('#cbd5e1');

    doc
      .rect(40, currentY, 515, 22)
      .fill('#334155');

    doc
      .fillColor('#ffffff')
      .font(fontBold)
      .fontSize(9)
      .text(
        'HEKİMİN NİHAİ DEĞERLENDİRMESİ VE KARARI',
        50,
        currentY + 6
      );

    // Klinik karar alanı
    doc
      .fillColor('#0f172a')
      .font(fontBold)
      .fontSize(9)
      .text('Klinik Karar:', 50, currentY + 32);

    doc
      .moveTo(130, currentY + 45)
      .lineTo(540, currentY + 45)
      .lineWidth(0.6)
      .strokeColor('#94a3b8')
      .stroke();

    // Hekim notu alanı
    doc
      .font(fontBold)
      .fontSize(9)
      .fillColor('#0f172a')
      .text('Hekim Notu:', 50, currentY + 54);

    doc
      .moveTo(130, currentY + 68)
      .lineTo(540, currentY + 68)
      .strokeColor('#94a3b8')
      .stroke();

    doc
      .moveTo(50, currentY + 82)
      .lineTo(540, currentY + 82)
      .stroke();

    // İmza alanı
    doc
      .font(fontBold)
      .fontSize(8)
      .fillColor('#334155')
      .text('Hekim Adı / İmza:', 50, currentY + 94);

    doc
      .moveTo(135, currentY + 105)
      .lineTo(320, currentY + 105)
      .strokeColor('#94a3b8')
      .stroke();

    doc
      .font(fontBold)
      .fontSize(8)
      .text('Tarih:', 365, currentY + 94);

    doc
      .moveTo(395, currentY + 105)
      .lineTo(540, currentY + 105)
      .stroke();

    currentY += clinicalHeight + 15;

    // ─── Footer / Yasal Uyarı ───
    // Footer sabit konumda; ikinci sayfaya taşmaması için
    // kısa iki satır halinde yerleştirilmiştir.
    doc
      .moveTo(40, 750)
      .lineTo(555, 750)
      .lineWidth(0.5)
      .strokeColor('#cbd5e1')
      .stroke();

    doc
      .font(fontRegular)
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(
        'YASAL UYARI: Bu rapor MammoVisionAI yapay zeka karar destek sistemi tarafından oluşturulmuştur. Kesin tanı yerine geçmez.',
        40,
        760,
        {
          width: 515,
          lineBreak: false,
        }
      );

    doc
      .font(fontRegular)
      .fontSize(7)
      .fillColor('#94a3b8')
      .text(
        'Nihai klinik değerlendirme ve karar sorumlu hekim tarafından verilmelidir.',
        40,
        772,
        {
          width: 515,
          lineBreak: false,
        }
      );

    doc.end();
  });
};
