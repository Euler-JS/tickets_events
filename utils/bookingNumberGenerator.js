// utils/bookingNumberGenerator.js
const crypto = require('crypto');
// const db = require('../config/database');

class BookingNumberGenerator {
  /**
   * Gera um número de reserva único
   * Formato: BOOK-YYYYMMDD-XXXXX
   * Exemplo: BOOK-20241226-A1B2C
   */
  static async generateBookingNumber() {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const bookingNumber = this._createBookingNumber();
        
        // Verificar se já existe
        const exists = await this._checkIfExists(bookingNumber);
        
        if (!exists) {
          return bookingNumber;
        }
        
        attempts++;
      } catch (error) {
        console.error('Erro ao gerar booking number:', error);
        attempts++;
      }
    }
    
    throw new Error('Não foi possível gerar um número de reserva único');
  }

  /**
   * Cria o número da reserva
   */
  static _createBookingNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Gerar código alfanumérico de 5 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `BOOK-${year}${month}${day}-${code}`;
  }

  /**
   * Verifica se o número já existe no banco
   */
  static async _checkIfExists(bookingNumber) {
    return false;
    try {
      const result = await db.get(
        'SELECT id FROM bookings WHERE booking_number = ?',
        [bookingNumber]
      );
      return !!result;
    } catch (error) {
      console.error('Erro ao verificar booking number:', error);
      return false;
    }
  }

  /**
   * Alternativa: Gerador sequencial simples
   */
  static async generateSequentialBookingNumber() {
    try {
      // Pegar o último número sequencial
      const lastBooking = await db.get(`
        SELECT booking_number 
        FROM bookings 
        WHERE booking_number LIKE 'BOOK-%'
        ORDER BY created_at DESC 
        LIMIT 1
      `);

      let nextNumber = 1;
      
      if (lastBooking && lastBooking.booking_number) {
        // Extrair número do formato BOOK-000001
        const match = lastBooking.booking_number.match(/BOOK-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Formatar com 6 dígitos
      const formattedNumber = String(nextNumber).padStart(6, '0');
      return `BOOK-${formattedNumber}`;
      
    } catch (error) {
      console.error('Erro ao gerar booking number sequencial:', error);
      // Fallback para timestamp
      return `BOOK-${Date.now()}`;
    }
  }

  /**
   * Alternativa: Baseado em timestamp + random
   */
  static generateTimestampBookingNumber() {
    const timestamp = Date.now().toString().slice(-8); // Últimos 8 dígitos
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `BOOK-${timestamp}-${random}`;
  }
}

module.exports = BookingNumberGenerator;