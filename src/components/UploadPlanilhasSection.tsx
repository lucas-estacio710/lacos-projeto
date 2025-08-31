// components/UploadPlanilhasSection.tsx - SEÇÃO DE UPLOAD DAS 3 PLANILHAS

import React, { useRef } from 'react';
import { Upload, FileSpreadsheet, Calendar, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { usePlanilhaUploads, type UploadStats } from '@/hooks/usePlanilhaUploads';
import { usePlanilhaStats } from '@/hooks/usePlanilhaStats'; // ⭐ NOVO HOOK

interface UploadPlanilhasSectionProps {
  onStatsUpdate?: () => void;
}

export function UploadPlanilhasSection({ onStatsUpdate }: UploadPlanilhasSectionProps) {
  const {
    uploadEntradasFinanceiras,
    uploadAgendaInter,
    uploadPercentuaisContrato,
    loading: uploadLoading,
    isLoading
  } = usePlanilhaUploads();

  // ⭐ NOVO HOOK - Stats do Supabase
  const { 
    getStats,
    refreshStats 
  } = usePlanilhaStats();

  // Refs para os inputs de arquivo
  const entradasFileRef = useRef<HTMLInputElement>(null);
  const agendaFileRef = useRef<HTMLInputElement>(null);
  const percentuaisFileRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // HANDLERS DE UPLOAD
  // ============================================================================

  const handleEntradasUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📤 Upload Entradas Financeiras:', file.name);
    
    const result = await uploadEntradasFinanceiras(file);
    
    if (result.success) {
      alert(`✅ Upload concluído!\n\n📊 ${result.stats?.total_registros} registros\n💰 R$ ${result.stats?.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n🏢 ${result.stats?.contratos_unicos} contratos únicos`);
      refreshStats(); // ⭐ Recarregar do Supabase
      onStatsUpdate?.();
    } else {
      const errorMsg = result.errors.slice(0, 5).join('\n'); // Mostrar apenas os primeiros 5 erros
      alert(`❌ Erro no upload:\n\n${errorMsg}${result.errors.length > 5 ? `\n\n... e mais ${result.errors.length - 5} erros` : ''}`);
    }

    // Limpar input
    event.target.value = '';
  };

  const handleAgendaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📤 Upload Agenda Inter:', file.name);
    
    const result = await uploadAgendaInter(file);
    
    if (result.success) {
      alert(`✅ Upload concluído!\n\n📊 ${result.stats?.total_registros} registros "Pago"\n💰 R$ ${result.stats?.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n🔗 ${result.stats?.transacoes_unicas} transações únicas`);
      refreshStats(); // ⭐ Recarregar do Supabase
      onStatsUpdate?.();
    } else {
      const errorMsg = result.errors.slice(0, 5).join('\n');
      alert(`❌ Erro no upload:\n\n${errorMsg}${result.errors.length > 5 ? `\n\n... e mais ${result.errors.length - 5} erros` : ''}`);
    }

    event.target.value = '';
  };

  const handlePercentuaisUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📤 Upload Percentuais Contrato:', file.name);
    
    const result = await uploadPercentuaisContrato(file);
    
    if (result.success) {
      alert(`✅ Upload concluído!\n\n📊 ${result.stats?.total_registros} registros\n🏢 ${result.stats?.contratos_unicos} contratos únicos\n🔗 ${result.stats?.transacoes_unicas} transações únicas`);
      refreshStats(); // ⭐ Recarregar do Supabase
      onStatsUpdate?.();
    } else {
      const errorMsg = result.errors.slice(0, 5).join('\n');
      alert(`❌ Erro no upload:\n\n${errorMsg}${result.errors.length > 5 ? `\n\n... e mais ${result.errors.length - 5} erros` : ''}`);
    }

    event.target.value = '';
  };

  // ============================================================================
  // HELPERS PARA FORMATAÇÃO
  // ============================================================================

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    
    try {
      // Se for ISO, converter para DD/MM/YYYY
      if (dateStr.includes('T')) {
        return new Date(dateStr).toLocaleDateString('pt-BR');
      }
      
      // Se for YYYY-MM-DD, converter para DD/MM/YYYY
      if (dateStr.includes('-') && dateStr.length === 10) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      }
      
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatValue = (value?: number): string => {
    if (!value) return 'R$ 0,00';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const formatUploadTime = (dateStr: string): string => {
    if (!dateStr) return 'Nunca';
    
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return 'Data inválida';
    }
  };

  // ============================================================================
  // COMPONENTE DE CARD DE UPLOAD
  // ============================================================================

  interface UploadCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    fileRef: React.RefObject<HTMLInputElement | null>;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    loading: boolean;
    stats: UploadStats | null;
    accept: string;
  }

  const UploadCard = ({ title, description, icon, color, fileRef, onUpload, loading, stats, accept }: UploadCardProps) => (
    <div className={`bg-gradient-to-br ${color} rounded-lg p-4 text-white relative`}>
      {/* Content */}
      <div className="flex items-center justify-between">
        {/* Left side - Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold truncate">{title}</h3>
            <div className="flex items-center gap-4 text-sm mt-1">
              {/* Período ou Registros */}
              {stats?.data_inicio && stats?.data_fim ? (
                <span className="text-xs opacity-80">
                  📅 {formatDate(stats.data_inicio)} - {formatDate(stats.data_fim)}
                </span>
              ) : stats?.total_registros ? (
                <span className="text-xs opacity-80">
                  📊 {stats.total_registros.toLocaleString('pt-BR')} registros
                </span>
              ) : (
                <span className="text-xs opacity-60">Sem dados</span>
              )}
              
              {/* Último upload */}
              {stats?.uploaded_at && (
                <span className="text-xs opacity-80">
                  📤 {new Date(stats.uploaded_at).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit' 
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex-shrink-0 flex items-center gap-2 ${
            loading
              ? 'bg-white/10 text-gray-300 cursor-not-allowed'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Novo Upload</span>
            </>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={onUpload}
          className="hidden"
        />
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="mb-8">

      {/* Upload Cards Grid */}
      <div className="space-y-4">
        
        {/* 1️⃣ Entradas Financeiras */}
        <UploadCard
          title="Entradas Financeiras"
          description="PIX Inter - Receitas por contrato"
          icon={<TrendingUp />}
          color="from-yellow-500 to-yellow-600"
          fileRef={entradasFileRef}
          onUpload={handleEntradasUpload}
          loading={isLoading('entradas_financeiras')}
          stats={getStats('entradas_financeiras')}
          accept=".csv"
        />

        {/* 2️⃣ Agenda Inter */}
        <UploadCard
          title="Agenda Inter"
          description="Inter Pag - Pagamentos recebidos"
          icon={<Calendar />}
          color="from-orange-500 to-orange-600"
          fileRef={agendaFileRef}
          onUpload={handleAgendaUpload}
          loading={isLoading('agenda_inter')}
          stats={getStats('agenda_inter')}
          accept=".csv"
        />

        {/* 3️⃣ Percentuais Contrato */}
        <UploadCard
          title="Percentuais Contrato"
          description="Inter Pag - % Catálogo vs Planos"
          icon={<FileSpreadsheet />}
          color="from-gray-500 to-gray-600"
          fileRef={percentuaisFileRef}
          onUpload={handlePercentuaisUpload}
          loading={isLoading('percentuais_contrato')}
          stats={getStats('percentuais_contrato')}
          accept=".csv"
        />
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-900/30 border border-blue-600 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-100">
            <div className="font-medium mb-1">💡 Dicas importantes:</div>
            <ul className="space-y-1 text-blue-200">
              <li>• <strong>Entradas Financeiras:</strong> Separador vírgula (,) - Formato: DD/MM/YYYY - Valores: 1.500,50</li>
              <li>• <strong>Agenda Inter:</strong> Separador ponto-e-vírgula (;) - Só registros "Pago"</li>
              <li>• <strong>Percentuais:</strong> Ignora primeira linha - % Catálogo + % Planos = 100%</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Clear Stats Button (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              // Limpar dados do Supabase (função de debug)
              console.log('🧹 Debug: Limpeza de stats (implementar se necessário)');
            }}
            className="text-xs text-gray-500 hover:text-gray-300 underline"
          >
            🧹 Limpar estatísticas (dev)
          </button>
        </div>
      )}
    </div>
  );
}