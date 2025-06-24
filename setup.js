#!/usr/bin/env node

/**
 * Script de configuração automatizada para o Sistema de Bilhetagem
 * Execute: node setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Função para validar URL do Supabase
function isValidSupabaseUrl(url) {
  return url && url.match(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
}

// Função para validar chave da API
function isValidApiKey(key) {
  return key && key.length > 20;
}

// Função para gerar JWT secret seguro
function generateJwtSecret() {
  return crypto.randomBytes(64).toString('hex');
}

// Função para criar estrutura de pastas
function createDirectories() {
  const dirs = [
    ' config',
    ' middleware',
    ' routes',
    ' validators',
    ' utils',
    'logs'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Pasta criada: ${dir}`);
    }
  });
}

// Função para criar arquivo .env
function createEnvFile(config) {
  const envContent = `# Supabase Configuration
SUPABASE_URL=${config.supabaseUrl}
SUPABASE_ANON_KEY=${config.anonKey}
SUPABASE_SERVICE_ROLE_KEY=${config.serviceRoleKey}

# Server Configuration
PORT=${config.port}
NODE_ENV=${config.environment}

# JWT Configuration
JWT_SECRET=${config.jwtSecret}
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=${config.corsOrigin}

# Frontend URL (para reset de senha)
FRONTEND_URL=${config.frontendUrl}
`;

  fs.writeFileSync('.env', envContent);
  console.log('✅ Arquivo .env criado');
}

// Função para verificar se npm install foi executado
function checkNodeModules() {
  if (!fs.existsSync('node_modules')) {
    console.log('\n⚠️  As dependências não estão instaladas.');
    console.log('Execute: npm install');
    return false;
  }
  return true;
}

// Função para testar conexão com Supabase
async function testSupabaseConnection(config) {
  try {
    console.log('\n🔄 Testando conexão com Supabase...');
    
    // Import dinâmico para evitar erro se módulos não estiverem instalados
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(config.supabaseUrl, config.anonKey);
    
    // Teste simples de conexão
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = tabela não encontrada (OK se ainda não executou SQL)
      console.log(`❌ Erro ao conectar: ${error.message}`);
      return false;
    }
    
    console.log('✅ Conexão com Supabase OK');
    return true;
  } catch (error) {
    console.log(`❌ Erro ao testar conexão: ${error.message}`);
    return false;
  }
}

// Script principal
async function setup() {
  console.log('🚀 Bem-vindo ao assistente de configuração do Sistema de Bilhetagem!\n');

  try {
    // Verificar se já existe .env
    if (fs.existsSync('.env')) {
      const overwrite = await question('Arquivo .env já existe. Deseja sobrescrever? (s/N): ');
      if (overwrite.toLowerCase() !== 's' && overwrite.toLowerCase() !== 'sim') {
        console.log('Configuração cancelada.');
        rl.close();
        return;
      }
    }

    console.log('📝 Vamos configurar suas variáveis de ambiente...\n');

    // Coletar informações do Supabase
    let supabaseUrl;
    do {
      supabaseUrl = await question('🔗 URL do projeto Supabase (ex: https://abc123.supabase.co): ');
      if (!isValidSupabaseUrl(supabaseUrl)) {
        console.log('❌ URL inválida. Use o formato: https://abc123.supabase.co');
      }
    } while (!isValidSupabaseUrl(supabaseUrl));

    let anonKey;
    do {
      anonKey = await question('🔑 Chave anon do Supabase: ');
      if (!isValidApiKey(anonKey)) {
        console.log('❌ Chave inválida. Deve ter mais de 20 caracteres.');
      }
    } while (!isValidApiKey(anonKey));

    let serviceRoleKey;
    do {
      serviceRoleKey = await question('🔐 Chave service_role do Supabase: ');
      if (!isValidApiKey(serviceRoleKey)) {
        console.log('❌ Chave inválida. Deve ter mais de 20 caracteres.');
      }
    } while (!isValidApiKey(serviceRoleKey));

    // Configurações do servidor
    const port = await question('🌐 Porta do servidor (padrão 3000): ') || '3000';
    const environment = await question('⚙️  Ambiente (development/production) [development]: ') || 'development';
    
    // URLs
    const corsOrigin = await question('🔒 CORS Origin (ex: http://localhost:3000): ') || 'http://localhost:3000';
    const frontendUrl = await question('🖥️  URL do frontend (ex: http://localhost:3000): ') || 'http://localhost:3000';

    // Gerar JWT secret
    const jwtSecret = generateJwtSecret();
    console.log('🔑 JWT Secret gerado automaticamente (64 caracteres)');

    const config = {
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      port,
      environment,
      corsOrigin,
      frontendUrl,
      jwtSecret
    };

    // Criar estrutura de pastas
    console.log('\n📁 Criando estrutura de pastas...');
    createDirectories();

    // Criar arquivo .env
    console.log('\n📄 Criando arquivo .env...');
    createEnvFile(config);

    // Verificar node_modules
    console.log('\n📦 Verificando dependências...');
    if (checkNodeModules()) {
      console.log('✅ Dependências já instaladas');
      
      // Testar conexão
      await testSupabaseConnection(config);
    } else {
      console.log('\n📋 Próximos passos:');
      console.log('1. Execute: npm install');
      console.log('2. Execute o script SQL no Supabase (SQL Editor)');
      console.log('3. Execute: node  utils/seedData.js (opcional)');
      console.log('4. Execute: npm run dev');
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('\n📋 Informações importantes:');
    console.log('- Arquivo .env criado com suas configurações');
    console.log('- JWT Secret gerado automaticamente');
    console.log('- Mantenha suas chaves secretas seguras');
    console.log('- Não commitie o arquivo .env no Git');

    console.log('\n📖 Próximos passos:');
    console.log('1. Execute o script SQL completo no Supabase');
    console.log('2. npm install (se ainda não executou)');
    console.log('3. node  utils/seedData.js (dados de exemplo)');
    console.log('4. npm run dev (iniciar servidor)');
    console.log('5. Acesse http://localhost:' + port + '/health');

    console.log('\n📚 Para mais informações, consulte:');
    console.log('- README.md - Documentação geral');
    console.log('- INSTALLATION.md - Guia de instalação detalhado');

  } catch (error) {
    console.error('\n❌ Erro durante a configuração:', error.message);
  } finally {
    rl.close();
  }
}

// Função para mostrar ajuda
function showHelp() {
  console.log(`
🛠️  Sistema de Bilhetagem - Assistente de Configuração

Uso: node setup.js [opção]

Opções:
  --help, -h     Mostrar esta ajuda
  --version, -v  Mostrar versão
  --check        Verificar configuração atual

Este script irá:
✅ Coletar suas configurações do Supabase
✅ Criar arquivo .env personalizado
✅ Gerar JWT secret seguro
✅ Criar estrutura de pastas
✅ Testar conexão com banco
✅ Mostrar próximos passos

Pré-requisitos:
📋 Projeto criado no Supabase
📋 Chaves de API do Supabase
📋 Node.js instalado
`);
}

// Função para verificar configuração atual
function checkCurrentConfig() {
  console.log('🔍 Verificando configuração atual...\n');

  if (!fs.existsSync('.env')) {
    console.log('❌ Arquivo .env não encontrado');
    return;
  }

  require('dotenv').config();

  const checks = [
    { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
    { name: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: 'JWT_SECRET', value: process.env.JWT_SECRET },
    { name: 'PORT', value: process.env.PORT },
    { name: 'NODE_ENV', value: process.env.NODE_ENV }
  ];

  checks.forEach(check => {
    const status = check.value ? '✅' : '❌';
    const valueDisplay = check.value ? 
      (check.name.includes('KEY') || check.name.includes('SECRET') ? 
        `${check.value.substring(0, 8)}...` : 
        check.value) : 
      'Não definido';
    console.log(`${status} ${check.name}: ${valueDisplay}`);
  });

  console.log('\n📦 Node modules:', fs.existsSync('node_modules') ? '✅ Instalado' : '❌ Não instalado');
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
} else if (args.includes('--version') || args.includes('-v')) {
  console.log('Sistema de Bilhetagem v1.0.0');
} else if (args.includes('--check')) {
  checkCurrentConfig();
} else {
  setup();
}