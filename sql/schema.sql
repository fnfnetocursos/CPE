-- =============================================================================
-- CONTROLE DE PONTO ELETRÔNICO - Schema PostgreSQL para Supabase
-- Execute este script no SQL Editor do painel Supabase
-- =============================================================================

-- Extensão UUID (já habilitada por padrão no Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABELAS
-- =============================================================================

CREATE TABLE empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    email_admin VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) CHECK (perfil IN ('MASTER', 'ADMIN', 'COLABORADOR')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE jornadas_trabalho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    descricao VARCHAR(100) NOT NULL,
    carga_diaria_minutos INTEGER NOT NULL,
    entrada_prevista TIME NOT NULL,
    saida_prevista TIME NOT NULL,
    tolerancia_minutos INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE colaboradores_detalhes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    matricula VARCHAR(50),
    jornada_id UUID REFERENCES jornadas_trabalho(id) ON DELETE SET NULL,
    data_admissao DATE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE (user_id, empresa_id)
);

CREATE TABLE feriados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
    data_feriado DATE NOT NULL,
    descricao VARCHAR(100) NOT NULL
);

CREATE TABLE afastamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    motivo VARCHAR(100) NOT NULL,
    abonado BOOLEAN DEFAULT TRUE,
    CHECK (data_fim >= data_inicio)
);

CREATE TABLE registros_ponto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_registro TIME NOT NULL DEFAULT CURRENT_TIME,
    tipo_registro VARCHAR(20) CHECK (
        tipo_registro IN ('ENTRADA', 'SAIDA_ALMOCO', 'RETORNO_ALMOCO', 'SAIDA', 'HORAS_EXTRA')
    ) NOT NULL,
    ip_equipamento VARCHAR(45),
    user_agent TEXT,
    nome_terminal_local VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_perfis_empresa ON perfis(empresa_id);
CREATE INDEX idx_registros_user_data ON registros_ponto(user_id, data_registro);
CREATE INDEX idx_registros_empresa_data ON registros_ponto(empresa_id, data_registro);
CREATE INDEX idx_afastamentos_user ON afastamentos(user_id, data_inicio, data_fim);
CREATE INDEX idx_feriados_data ON feriados(data_feriado);

-- =============================================================================
-- 2. FUNÇÕES AUXILIARES PARA RLS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_perfil()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT perfil FROM perfis WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT empresa_id FROM perfis WHERE id = auth.uid();
$$;

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores_detalhes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE afastamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;

-- EMPRESAS
CREATE POLICY empresas_master_all ON empresas
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY empresas_admin_select ON empresas
    FOR SELECT USING (
        public.get_user_perfil() = 'ADMIN'
        AND id = public.get_user_empresa_id()
    );

CREATE POLICY empresas_colaborador_select ON empresas
    FOR SELECT USING (
        public.get_user_perfil() = 'COLABORADOR'
        AND id = public.get_user_empresa_id()
    );

-- PERFIS
CREATE POLICY perfis_master_all ON perfis
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY perfis_admin_select ON perfis
    FOR SELECT USING (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
    );

CREATE POLICY perfis_admin_insert ON perfis
    FOR INSERT WITH CHECK (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
        AND perfil = 'COLABORADOR'
    );

CREATE POLICY perfis_admin_update ON perfis
    FOR UPDATE USING (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
    );

CREATE POLICY perfis_self_select ON perfis
    FOR SELECT USING (id = auth.uid());

CREATE POLICY perfis_self_update ON perfis
    FOR UPDATE USING (id = auth.uid());

-- JORNADAS
CREATE POLICY jornadas_master_all ON jornadas_trabalho
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY jornadas_admin_all ON jornadas_trabalho
    FOR ALL USING (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
    );

CREATE POLICY jornadas_colaborador_select ON jornadas_trabalho
    FOR SELECT USING (
        public.get_user_perfil() = 'COLABORADOR'
        AND empresa_id = public.get_user_empresa_id()
    );

-- COLABORADORES DETALHES
CREATE POLICY colab_master_all ON colaboradores_detalhes
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY colab_admin_all ON colaboradores_detalhes
    FOR ALL USING (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
    );

CREATE POLICY colab_self_select ON colaboradores_detalhes
    FOR SELECT USING (user_id = auth.uid());

-- FERIADOS
CREATE POLICY feriados_master_all ON feriados
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY feriados_admin_all ON feriados
    FOR ALL USING (
        public.get_user_perfil() = 'ADMIN'
        AND (empresa_id = public.get_user_empresa_id() OR empresa_id IS NULL)
    );

CREATE POLICY feriados_colaborador_select ON feriados
    FOR SELECT USING (
        public.get_user_perfil() = 'COLABORADOR'
        AND (empresa_id = public.get_user_empresa_id() OR empresa_id IS NULL)
    );

-- AFASTAMENTOS
CREATE POLICY afast_master_all ON afastamentos
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY afast_admin_all ON afastamentos
    FOR ALL USING (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
    );

CREATE POLICY afast_colaborador_select ON afastamentos
    FOR SELECT USING (user_id = auth.uid());

-- REGISTROS DE PONTO
CREATE POLICY ponto_master_all ON registros_ponto
    FOR ALL USING (public.get_user_perfil() = 'MASTER');

CREATE POLICY ponto_admin_select ON registros_ponto
    FOR SELECT USING (
        public.get_user_perfil() = 'ADMIN'
        AND empresa_id = public.get_user_empresa_id()
    );

CREATE POLICY ponto_colaborador_select ON registros_ponto
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY ponto_colaborador_insert ON registros_ponto
    FOR INSERT WITH CHECK (
        public.get_user_perfil() = 'COLABORADOR'
        AND user_id = auth.uid()
        AND empresa_id = public.get_user_empresa_id()
    );

-- =============================================================================
-- 4. TRIGGER: criar perfil automaticamente após signup (opcional)
-- O perfil real deve ser configurado pelo MASTER/ADMIN após criação do usuário
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.perfis (id, nome, perfil, empresa_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'perfil', 'COLABORADOR'),
        (NEW.raw_user_meta_data->>'empresa_id')::UUID
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 5. INSTRUÇÕES PARA USUÁRIO MASTER INICIAL
-- =============================================================================
-- 1. Crie um usuário em Authentication > Users no Supabase
-- 2. Execute (substituindo o UUID):
--
-- UPDATE perfis SET perfil = 'MASTER', empresa_id = NULL, nome = 'Administrador Master'
-- WHERE id = 'UUID-DO-USUARIO-AQUI';
--
-- Ou crie via signUp com metadata:
-- { "nome": "Admin Master", "perfil": "MASTER" }
