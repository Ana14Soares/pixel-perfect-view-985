export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string | null
          id: string
          matricula: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          matricula: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          matricula?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          criado_em: string
          dados: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          dados?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          dados?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      emprestimos: {
        Row: {
          aluno_id: string
          cancelado_em: string | null
          condicao_devolucao:
            | Database["public"]["Enums"]["condicao_devolucao"]
            | null
          criado_em: string
          devolvido_em: string | null
          equipamento_id: string
          id: string
          motivo_cancelamento: string | null
          observacao_devolucao: string | null
          previsto_para: string
          retirado_em: string
        }
        Insert: {
          aluno_id: string
          cancelado_em?: string | null
          condicao_devolucao?:
            | Database["public"]["Enums"]["condicao_devolucao"]
            | null
          criado_em?: string
          devolvido_em?: string | null
          equipamento_id: string
          id?: string
          motivo_cancelamento?: string | null
          observacao_devolucao?: string | null
          previsto_para: string
          retirado_em?: string
        }
        Update: {
          aluno_id?: string
          cancelado_em?: string | null
          condicao_devolucao?:
            | Database["public"]["Enums"]["condicao_devolucao"]
            | null
          criado_em?: string
          devolvido_em?: string | null
          equipamento_id?: string
          id?: string
          motivo_cancelamento?: string | null
          observacao_devolucao?: string | null
          previsto_para?: string
          retirado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "emprestimos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emprestimos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          categoria: string
          criado_em: string
          id: string
          nome: string
          observacoes: string | null
          patrimonio: string
          status: Database["public"]["Enums"]["equipamento_status"]
        }
        Insert: {
          categoria: string
          criado_em?: string
          id?: string
          nome: string
          observacoes?: string | null
          patrimonio: string
          status?: Database["public"]["Enums"]["equipamento_status"]
        }
        Update: {
          categoria?: string
          criado_em?: string
          id?: string
          nome?: string
          observacoes?: string | null
          patrimonio?: string
          status?: Database["public"]["Enums"]["equipamento_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aluno_pendencia: {
        Args: { p_aluno_id: string }
        Returns: {
          maior_atraso: number
          qtd: number
        }[]
      }
      fn_alterar_status_equipamento: {
        Args: {
          p_equipamento_id: string
          p_status: Database["public"]["Enums"]["equipamento_status"]
        }
        Returns: Json
      }
      fn_cancelar: {
        Args: { p_emprestimo_id: string; p_motivo: string }
        Returns: Json
      }
      fn_devolver: {
        Args: {
          p_condicao: Database["public"]["Enums"]["condicao_devolucao"]
          p_emprestimo_id: string
          p_observacao?: string
        }
        Returns: Json
      }
      fn_emprestar: {
        Args: {
          p_aluno_id: string
          p_equipamento_id: string
          p_previsto_para: string
        }
        Returns: Json
      }
      fn_marcar_extravio: { Args: { p_emprestimo_id: string }; Returns: Json }
      fn_reset_demo: { Args: never; Returns: Json }
      hoje_local: { Args: never; Returns: string }
    }
    Enums: {
      condicao_devolucao: "OK" | "AVARIADO"
      equipamento_status:
        | "DISPONIVEL"
        | "EMPRESTADO"
        | "MANUTENCAO"
        | "EXTRAVIADO"
        | "BAIXADO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      condicao_devolucao: ["OK", "AVARIADO"],
      equipamento_status: [
        "DISPONIVEL",
        "EMPRESTADO",
        "MANUTENCAO",
        "EXTRAVIADO",
        "BAIXADO",
      ],
    },
  },
} as const
