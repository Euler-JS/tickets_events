const express = require('express');
const multer = require('multer');
const { supabase } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const path = require('path');

const router = express.Router();

// Configurar multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'), false);
    }
  }
});

/**
 * POST /api/upload/event-poster
 * Upload de poster para evento
 */
router.post('/event-poster', authenticate, upload.single('poster'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Nenhum arquivo enviado', 400, 'NO_FILE');
  }

  const file = req.file;
  const fileExt = path.extname(file.originalname);
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${fileExt}`;
  const filePath = `event-posters/${fileName}`;

  // Upload para Supabase Storage
  const { data, error } = await supabase.storage
    .from('event-images') // Bucket name
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('Erro no upload:', error);
    throw new AppError('Erro ao fazer upload da imagem: ' + error.message, 500, 'UPLOAD_ERROR');
  }

  // Obter URL pública
  const { data: publicUrl } = supabase.storage
    .from('event-images')
    .getPublicUrl(filePath);

  res.json({
    message: 'Upload realizado com sucesso',
    url: publicUrl.publicUrl,
    fileName: fileName,
    originalName: file.originalname,
    size: file.size
  });
}));

module.exports = router;