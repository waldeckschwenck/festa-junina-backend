// Backend para processamento de pagamentos da Festa Junina do Bambuzal
// Integração com Mercado Pago para PIX e Cartão de Crédito

const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuração de CORS para permitir requisições do frontend
app.use(cors({
  origin: '*', // Em produção, especifique o domínio exato do seu frontend
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configuração do Mercado Pago com o Access Token
mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'TEST-5785827381416651-052416-9f8132ea4ceda73e0981ab2fcee2063a-75311843'
});

// Rota de verificação de saúde do servidor
app.get('/', (req, res) => {
  res.status(200).send({
    status: 'success',
    message: 'Backend da Festa Junina do Bambuzal funcionando corretamente!'
  });
});

// Endpoint para processar pagamentos
app.post('/process_payment', async (req, res) => {
  try {
    console.log('Recebendo solicitação de pagamento:', req.body);
    
    const { selectedPaymentMethod, formData } = req.body;
    
    // Gerar ID único para o ingresso
    const ticketId = uuidv4();
    
    let paymentData = {
      transaction_amount: Number(formData.transaction_amount),
      description: 'Ingresso Festa Junina do Bambuzal',
      payment_method_id: formData.payment_method_id,
      payer: {
        email: formData.payer.email,
        first_name: formData.payer.first_name || 'Comprador',
        last_name: formData.payer.last_name || 'Festa Junina'
      },
      metadata: {
        ticket_id: ticketId
      }
    };
    
    // Configurações específicas para cada método de pagamento
    if (selectedPaymentMethod === 'credit_card') {
      paymentData = {
        ...paymentData,
        token: formData.token,
        installments: Number(formData.installments) || 1
      };
    } else if (selectedPaymentMethod === 'pix') {
      paymentData = {
        ...paymentData,
        payment_method_id: 'pix',
        payment_type_id: 'bank_transfer'
      };
    }
    
    console.log('Dados de pagamento:', paymentData);
    
    // Criar o pagamento no Mercado Pago
    const payment = await mercadopago.payment.create(paymentData);
    
    console.log('Resposta do Mercado Pago:', payment);
    
    // Verificar se o pagamento foi criado com sucesso
    if (payment && payment.response) {
      const paymentResponse = payment.response;
      
      // Para pagamentos PIX, extrair o QR code
      let pixQrCode = null;
      let pixQrCodeBase64 = null;
      
      if (selectedPaymentMethod === 'pix' && paymentResponse.point_of_interaction && 
          paymentResponse.point_of_interaction.transaction_data && 
          paymentResponse.point_of_interaction.transaction_data.qr_code) {
        
        pixQrCode = paymentResponse.point_of_interaction.transaction_data.qr_code;
        
        // Gerar imagem do QR code
        try {
          pixQrCodeBase64 = await QRCode.toDataURL(pixQrCode);
        } catch (qrError) {
          console.error('Erro ao gerar QR code:', qrError);
        }
      }
      
      // Enviar e-mail com o ingresso (simulado)
      // Em um ambiente real, você implementaria o envio de e-mail aqui
      
      // Responder com os dados do pagamento
      res.status(200).json({
        status: 'success',
        message: 'Pagamento processado com sucesso',
        payment_id: paymentResponse.id,
        status: paymentResponse.status,
        status_detail: paymentResponse.status_detail,
        ticket_id: ticketId,
        pix_qr_code: pixQrCode,
        pix_qr_code_base64: pixQrCodeBase64
      });
    } else {
      throw new Error('Falha ao processar pagamento');
    }
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao processar pagamento',
      error: error.message
    });
  }
});

// Endpoint para verificar status do pagamento
app.get('/payment_status/:payment_id', async (req, res) => {
  try {
    const { payment_id } = req.params;
    
    const payment = await mercadopago.payment.get(payment_id);
    
    if (payment && payment.response) {
      res.status(200).json({
        status: 'success',
        payment_status: payment.response.status,
        payment_status_detail: payment.response.status_detail
      });
    } else {
      throw new Error('Pagamento não encontrado');
    }
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao verificar status do pagamento',
      error: error.message
    });
  }
});

// Webhook para receber notificações do Mercado Pago
app.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    console.log('Webhook recebido:', { type, data });
    
    // Processar apenas notificações de pagamento
    if (type === 'payment') {
      const paymentId = data.id;
      
      // Obter detalhes do pagamento
      const payment = await mercadopago.payment.get(paymentId);
      
      if (payment && payment.response) {
        const paymentStatus = payment.response.status;
        
        // Se o pagamento foi aprovado, enviar o ingresso por e-mail
        if (paymentStatus === 'approved') {
          // Em um ambiente real, você implementaria o envio de e-mail aqui
          console.log(`Pagamento ${paymentId} aprovado. Enviando ingresso por e-mail...`);
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).send('Erro ao processar webhook');
  }
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
