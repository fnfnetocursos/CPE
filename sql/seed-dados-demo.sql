-- =============================================================================
-- CONTROLE DE PONTO — DADOS DE DEMONSTRAÇÃO (SEED)
-- Execute APÓS o schema.sql, no SQL Editor do Supabase.
--
-- ⚠ APENAS PARA TESTES/DEMO — senhas simples, sem preocupação com segurança.
-- =============================================================================
--
-- ┌─────────────────────────────┬──────────────────────────┬──────────┐
-- │ E-mail                      │ Senha                    │ Perfil   │
-- ├─────────────────────────────┼──────────────────────────┼──────────┤
-- │ master@demo.com             │ 123456                   │ MASTER   │
-- │ admin@techsol.demo.com      │ 123456                   │ ADMIN    │
-- │ admin@logistica.demo.com    │ 123456                   │ ADMIN    │
-- │ ana@techsol.demo.com        │ 123456                   │ COLAB.   │
-- │ bruno@techsol.demo.com      │ 123456                   │ COLAB.   │
-- │ carla@techsol.demo.com      │ 123456                   │ COLAB.   │
-- │ diego@logistica.demo.com    │ 123456                   │ COLAB.   │
-- └─────────────────────────────┴──────────────────────────┴──────────┘
--
-- Empresas demo:
--   • Tech Solutions Ltda      (CNPJ 12.345.678/0001-90)
--   • Logística Express S.A.   (CNPJ 98.765.432/0001-10)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 0. LIMPEZA (reexecução segura — remove somente registros demo)
-- =============================================================================

DELETE FROM registros_ponto
WHERE empresa_id IN (
    'e1111111-1111-1111-1111-111111111101'::uuid,
    'e1111111-1111-1111-1111-111111111102'::uuid
);

DELETE FROM afastamentos
WHERE empresa_id IN (
    'e1111111-1111-1111-1111-111111111101'::uuid,
    'e1111111-1111-1111-1111-111111111102'::uuid
);

DELETE FROM feriados
WHERE id IN (
    'f1111111-1111-1111-1111-111111111001'::uuid,
    'f1111111-1111-1111-1111-111111111002'::uuid,
    'f1111111-1111-1111-1111-111111111003'::uuid,
    'f1111111-1111-1111-1111-111111111004'::uuid
);

DELETE FROM colaboradores_detalhes
WHERE empresa_id IN (
    'e1111111-1111-1111-1111-111111111101'::uuid,
    'e1111111-1111-1111-1111-111111111102'::uuid
);

DELETE FROM jornadas_trabalho
WHERE empresa_id IN (
    'e1111111-1111-1111-1111-111111111101'::uuid,
    'e1111111-1111-1111-1111-111111111102'::uuid
);

DELETE FROM perfis
WHERE id IN (
    'a1111111-1111-1111-1111-111111111001'::uuid,
    'a1111111-1111-1111-1111-111111111011'::uuid,
    'a1111111-1111-1111-1111-111111111012'::uuid,
    'a1111111-1111-1111-1111-111111111021'::uuid,
    'a1111111-1111-1111-1111-111111111022'::uuid,
    'a1111111-1111-1111-1111-111111111023'::uuid,
    'a1111111-1111-1111-1111-111111111031'::uuid
);

DELETE FROM auth.identities
WHERE user_id IN (
    'a1111111-1111-1111-1111-111111111001'::uuid,
    'a1111111-1111-1111-1111-111111111011'::uuid,
    'a1111111-1111-1111-1111-111111111012'::uuid,
    'a1111111-1111-1111-1111-111111111021'::uuid,
    'a1111111-1111-1111-1111-111111111022'::uuid,
    'a1111111-1111-1111-1111-111111111023'::uuid,
    'a1111111-1111-1111-1111-111111111031'::uuid
);

DELETE FROM auth.users
WHERE id IN (
    'a1111111-1111-1111-1111-111111111001'::uuid,
    'a1111111-1111-1111-1111-111111111011'::uuid,
    'a1111111-1111-1111-1111-111111111012'::uuid,
    'a1111111-1111-1111-1111-111111111021'::uuid,
    'a1111111-1111-1111-1111-111111111022'::uuid,
    'a1111111-1111-1111-1111-111111111023'::uuid,
    'a1111111-1111-1111-1111-111111111031'::uuid
);

DELETE FROM empresas
WHERE id IN (
    'e1111111-1111-1111-1111-111111111101'::uuid,
    'e1111111-1111-1111-1111-111111111102'::uuid
);

-- =============================================================================
-- 1. FUNÇÃO AUXILIAR — cria usuário auth + identity (dispara trigger de perfil)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_criar_usuario_demo(
    p_id          UUID,
    p_email       TEXT,
    p_senha       TEXT,
    p_nome        TEXT,
    p_perfil      TEXT,
    p_empresa_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_meta JSONB;
BEGIN
    v_meta := jsonb_build_object('nome', p_nome, 'perfil', p_perfil);
    IF p_empresa_id IS NOT NULL THEN
        v_meta := v_meta || jsonb_build_object('empresa_id', p_empresa_id::text);
    END IF;

    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        p_id,
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_senha, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        v_meta,
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        p_id,
        p_id::text,
        p_id,
        jsonb_build_object(
            'sub', p_id::text,
            'email', p_email,
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    RETURN p_id;
END;
$$;

-- =============================================================================
-- 2. EMPRESAS
-- =============================================================================

INSERT INTO empresas (id, razao_social, cnpj, email_admin) VALUES
(
    'e1111111-1111-1111-1111-111111111101',
    'Tech Solutions Ltda',
    '12.345.678/0001-90',
    'admin@techsol.demo.com'
),
(
    'e1111111-1111-1111-1111-111111111102',
    'Logística Express S.A.',
    '98.765.432/0001-10',
    'admin@logistica.demo.com'
);

-- =============================================================================
-- 3. USUÁRIOS (auth.users) — senha padrão demo: 123456
--    O trigger handle_new_user cria automaticamente o registro em perfis.
-- =============================================================================

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111001',
    'master@demo.com',
    '123456',
    'Administrador Master',
    'MASTER',
    NULL
);

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111011',
    'admin@techsol.demo.com',
    '123456',
    'Carlos Mendes (Admin)',
    'ADMIN',
    'e1111111-1111-1111-1111-111111111101'
);

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111012',
    'admin@logistica.demo.com',
    '123456',
    'Fernanda Lima (Admin)',
    'ADMIN',
    'e1111111-1111-1111-1111-111111111102'
);

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111021',
    'ana@techsol.demo.com',
    '123456',
    'Ana Paula Silva',
    'COLABORADOR',
    'e1111111-1111-1111-1111-111111111101'
);

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111022',
    'bruno@techsol.demo.com',
    '123456',
    'Bruno Oliveira',
    'COLABORADOR',
    'e1111111-1111-1111-1111-111111111101'
);

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111023',
    'carla@techsol.demo.com',
    '123456',
    'Carla Souza',
    'COLABORADOR',
    'e1111111-1111-1111-1111-111111111101'
);

SELECT public.seed_criar_usuario_demo(
    'a1111111-1111-1111-1111-111111111031',
    'diego@logistica.demo.com',
    '123456',
    'Diego Ferreira',
    'COLABORADOR',
    'e1111111-1111-1111-1111-111111111102'
);

-- Garante perfil MASTER sem empresa (trigger pode não setar NULL corretamente em alguns casos)
UPDATE perfis
SET perfil = 'MASTER', empresa_id = NULL, nome = 'Administrador Master'
WHERE id = 'a1111111-1111-1111-1111-111111111001';

-- =============================================================================
-- 4. JORNADAS DE TRABALHO
-- =============================================================================

INSERT INTO jornadas_trabalho (id, empresa_id, descricao, carga_diaria_minutos, entrada_prevista, saida_prevista, tolerancia_minutos) VALUES
(
    'd1111111-1111-1111-1111-111111111001',
    'e1111111-1111-1111-1111-111111111101',
    'Turno Comercial (8h–17h)',
    480,
    '08:00:00',
    '17:00:00',
    10
),
(
    'd1111111-1111-1111-1111-111111111002',
    'e1111111-1111-1111-1111-111111111101',
    'Turno Sábado (8h–12h)',
    240,
    '08:00:00',
    '12:00:00',
    5
),
(
    'd1111111-1111-1111-1111-111111111003',
    'e1111111-1111-1111-1111-111111111102',
    'Escala Manhã (6h)',
    360,
    '06:00:00',
    '12:00:00',
    10
);

-- =============================================================================
-- 5. COLABORADORES (detalhes)
-- =============================================================================

INSERT INTO colaboradores_detalhes (id, user_id, empresa_id, matricula, jornada_id, data_admissao, ativo) VALUES
(
    'c1111111-1111-1111-1111-111111111001',
    'a1111111-1111-1111-1111-111111111021',
    'e1111111-1111-1111-1111-111111111101',
    'TS-001',
    'd1111111-1111-1111-1111-111111111001',
    '2024-03-15',
    TRUE
),
(
    'c1111111-1111-1111-1111-111111111002',
    'a1111111-1111-1111-1111-111111111022',
    'e1111111-1111-1111-1111-111111111101',
    'TS-002',
    'd1111111-1111-1111-1111-111111111001',
    '2023-08-01',
    TRUE
),
(
    'c1111111-1111-1111-1111-111111111003',
    'a1111111-1111-1111-1111-111111111023',
    'e1111111-1111-1111-1111-111111111101',
    'TS-003',
    'd1111111-1111-1111-1111-111111111001',
    '2025-01-10',
    TRUE
),
(
    'c1111111-1111-1111-1111-111111111004',
    'a1111111-1111-1111-1111-111111111031',
    'e1111111-1111-1111-1111-111111111102',
    'LE-001',
    'd1111111-1111-1111-1111-111111111003',
    '2024-11-20',
    TRUE
);

-- =============================================================================
-- 6. FERIADOS (nacionais + empresa)
-- =============================================================================

INSERT INTO feriados (id, empresa_id, data_feriado, descricao) VALUES
(
    'f1111111-1111-1111-1111-111111111001',
    NULL,
    MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1),
    'Ano Novo'
),
(
    'f1111111-1111-1111-1111-111111111002',
    NULL,
    MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, 4, 21),
    'Tiradentes'
),
(
    'f1111111-1111-1111-1111-111111111003',
    NULL,
    MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 25),
    'Natal'
),
(
    'f1111111-1111-1111-1111-111111111004',
    'e1111111-1111-1111-1111-111111111101',
    MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, 6, 15),
    'Aniversário Tech Solutions'
);

-- =============================================================================
-- 7. AFASTAMENTOS (com abono)
-- =============================================================================

INSERT INTO afastamentos (id, user_id, empresa_id, data_inicio, data_fim, motivo, abonado) VALUES
(
    'b1111111-1111-1111-1111-111111111001',
    'a1111111-1111-1111-1111-111111111022',
    'e1111111-1111-1111-1111-111111111101',
    CURRENT_DATE - 2,
    CURRENT_DATE - 1,
    'Atestado Médico',
    TRUE
),
(
    'b1111111-1111-1111-1111-111111111002',
    'a1111111-1111-1111-1111-111111111021',
    'e1111111-1111-1111-1111-111111111101',
    CURRENT_DATE + 10,
    CURRENT_DATE + 20,
    'Férias',
    TRUE
);

-- =============================================================================
-- 8. REGISTROS DE PONTO (últimos dias úteis relativos a CURRENT_DATE)
--    Cenários: pontual, atraso, hora extra, falta, afastamento abonado
-- =============================================================================

-- Função auxiliar: insere batida se o dia for útil (seg–sex)
CREATE OR REPLACE FUNCTION public.seed_batida(
    p_user_id    UUID,
    p_empresa_id UUID,
    p_dias_atras INTEGER,
    p_hora       TIME,
    p_tipo       TEXT,
    p_terminal   TEXT DEFAULT 'Terminal-Demo-01'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_data DATE := CURRENT_DATE - p_dias_atras;
BEGIN
    IF EXTRACT(ISODOW FROM v_data) BETWEEN 1 AND 5 THEN
        INSERT INTO registros_ponto (
            user_id, empresa_id, data_registro, hora_registro,
            tipo_registro, ip_equipamento, user_agent, nome_terminal_local
        ) VALUES (
            p_user_id,
            p_empresa_id,
            v_data,
            p_hora,
            p_tipo,
            '192.168.0.100',
            'Mozilla/5.0 (Demo Seed)',
            p_terminal
        );
    END IF;
END;
$$;

-- ANA PAULA — assiduidade regular + 1 atraso + 1 dia com hora extra + presente hoje
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 10, '08:02:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 10, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 10, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 10, '17:05:00', 'SAIDA');

SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 9, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 9, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 9, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 9, '17:00:00', 'SAIDA');

-- Atraso (> tolerância de 10 min)
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 8, '08:25:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 8, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 8, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 8, '17:00:00', 'SAIDA');

-- Hora extra (saída após 17h)
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 7, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 7, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 7, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 7, '18:30:00', 'SAIDA');

SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 6, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 6, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 6, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 6, '17:00:00', 'SAIDA');

-- Hoje: só entrada (KPI "presentes hoje")
SELECT seed_batida('a1111111-1111-1111-1111-111111111021', 'e1111111-1111-1111-1111-111111111101', 0, '08:05:00', 'ENTRADA');

-- BRUNO — falta em dia útil (sem batidas 5 dias atrás) + afastamento abonado (d-2, d-1)
-- Dia -5: falta total (nenhuma batida inserida propositalmente)
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 9, '08:10:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 9, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 9, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 9, '17:00:00', 'SAIDA');

SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 8, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 8, '17:00:00', 'SAIDA');

-- Dias -2 e -1: afastamento abonado (sem batidas)

SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 6, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 6, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 6, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111022', 'e1111111-1111-1111-1111-111111111101', 6, '17:00:00', 'SAIDA');

-- CARLA — horas extras frequentes
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 10, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 10, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 10, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 10, '19:00:00', 'SAIDA');

SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 9, '08:00:00', 'ENTRADA');
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 9, '12:00:00', 'SAIDA_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 9, '13:00:00', 'RETORNO_ALMOCO');
SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 9, '18:15:00', 'HORAS_EXTRA');

SELECT seed_batida('a1111111-1111-1111-1111-111111111023', 'e1111111-1111-1111-1111-111111111101', 0, '08:00:00', 'ENTRADA');

-- DIEGO — Logística Express (jornada 6h–12h)
SELECT seed_batida('a1111111-1111-1111-1111-111111111031', 'e1111111-1111-1111-1111-111111111102', 10, '06:05:00', 'ENTRADA', 'Terminal-Expedicao-01');
SELECT seed_batida('a1111111-1111-1111-1111-111111111031', 'e1111111-1111-1111-1111-111111111102', 10, '12:00:00', 'SAIDA', 'Terminal-Expedicao-01');

SELECT seed_batida('a1111111-1111-1111-1111-111111111031', 'e1111111-1111-1111-1111-111111111102', 9, '06:00:00', 'ENTRADA', 'Terminal-Expedicao-01');
SELECT seed_batida('a1111111-1111-1111-1111-111111111031', 'e1111111-1111-1111-1111-111111111102', 9, '12:10:00', 'SAIDA', 'Terminal-Expedicao-01');

SELECT seed_batida('a1111111-1111-1111-1111-111111111031', 'e1111111-1111-1111-1111-111111111102', 0, '06:00:00', 'ENTRADA', 'Terminal-Expedicao-01');

-- =============================================================================
-- 9. LIMPEZA DE FUNÇÕES AUXILIARES (opcional — comente se quiser reutilizar)
-- =============================================================================

DROP FUNCTION IF EXISTS public.seed_batida(UUID, UUID, INTEGER, TIME, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.seed_criar_usuario_demo(UUID, TEXT, TEXT, TEXT, TEXT, UUID);

-- =============================================================================
-- 10. VERIFICAÇÃO RÁPIDA
-- =============================================================================

SELECT 'Empresas' AS tabela, COUNT(*) AS total FROM empresas
UNION ALL SELECT 'Perfis', COUNT(*) FROM perfis
UNION ALL SELECT 'Jornadas', COUNT(*) FROM jornadas_trabalho
UNION ALL SELECT 'Colaboradores', COUNT(*) FROM colaboradores_detalhes
UNION ALL SELECT 'Feriados', COUNT(*) FROM feriados
UNION ALL SELECT 'Afastamentos', COUNT(*) FROM afastamentos
UNION ALL SELECT 'Registros Ponto', COUNT(*) FROM registros_ponto;

-- =============================================================================
-- ROTEIRO DE DEMONSTRAÇÃO SUGERIDO
-- =============================================================================
-- 1. Login MASTER (master@demo.com / 123456)
--    → Ver 2 empresas, exportar CSV global
-- 2. Login ADMIN Tech Solutions (admin@techsol.demo.com / 123456)
--    → Dashboard: presentes, faltas, horas extra
--    → Relatório: colaborador Ana Paula, período mês atual
--    → Ver espelho com crédito/débito, atraso e hora extra
-- 3. Login COLABORADOR Ana (ana@techsol.demo.com / 123456)
--    → Ver batidas de hoje, registrar nova batida
-- 4. Login ADMIN Logística (admin@logistica.demo.com / 123456)
--    → Ver colaborador Diego (jornada 6h)
-- =============================================================================
