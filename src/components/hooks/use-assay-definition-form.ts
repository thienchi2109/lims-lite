"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getAssayDefinitionMethodName } from "@/lib/assay-method-name";
import {
  AssayFormSchema,
  AssayFormValues,
  AssayFormMode,
  AssayDefinition,
  RawValidationRules,
} from "@/components/assay-definition-dialog/types";
import {
  createAssayDefinitionClient,
  updateAssayDefinitionClient,
  fetchMethodNameSuggestionsClient,
} from "@/lib/api-client";

type UseAssayDefinitionFormProps = {
  mode: Exclude<AssayFormMode, "view">;
  assay?: AssayDefinition;
  onCreated?: (assay: AssayDefinition) => void;
  onUpdated?: (assay: AssayDefinition) => void;
  onClose: () => void;
};

export function useAssayDefinitionForm({
  mode,
  assay,
  onCreated,
  onUpdated,
  onClose,
}: UseAssayDefinitionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [methodNameSuggestions, setMethodNameSuggestions] = useState<string[]>([]);
  const [loadingMethodNameSuggestions, setLoadingMethodNameSuggestions] = useState(false);

  const form = useForm<AssayFormValues>({
    resolver: zodResolver(AssayFormSchema),
    defaultValues: {
      name: "",
      specialtyId: "",
      methodName: "",
      units: "",
      isConfidential: false,
      validationRules: {
        type: "numeric",
        required: false,
      },
    },
  });

  // Initialize form from existing assay data (edit mode)
  const initializeForm = useCallback(
    (assayData: AssayDefinition) => {
      const rules = assayData.validation_rules as RawValidationRules | null;
      form.reset({
        name: assayData.name,
        specialtyId: assayData.specialty_id || "",
        methodName: getAssayDefinitionMethodName(assayData),
        units: assayData.units || "",
        isConfidential: assayData.is_confidential ?? false,
        validationRules: {
          min: rules?.min,
          max: rules?.max,
          type:
            rules?.type ||
            (rules?.dataType as "numeric" | "text" | "boolean") ||
            "numeric",
          required: rules?.required || false,
        },
      });
    },
    [form],
  );

  const loadMethodNameSuggestions = useCallback(async () => {
    setLoadingMethodNameSuggestions(true);
    const result = await fetchMethodNameSuggestionsClient();
    if (result.data) {
      const suggestions = result.data as string[];
      const uniqueSuggestions = suggestions.filter(
        (suggestion, index, self) =>
          suggestion.trim() &&
          index === self.findIndex((item) => item.trim().toLowerCase() === suggestion.trim().toLowerCase()),
      );
      setMethodNameSuggestions(uniqueSuggestions);
    }
    setLoadingMethodNameSuggestions(false);
  }, []);

  const resetForm = useCallback(() => {
    form.reset({
      name: "",
      specialtyId: "",
      methodName: "",
      units: "",
      isConfidential: false,
      validationRules: {
        type: "numeric",
        required: false,
      },
    });
  }, [form]);

  const onSubmit = form.handleSubmit((values) => {
    if (mode === "edit" && !assay) {
      toast.error("Không tìm thấy chỉ tiêu để cập nhật");
      return;
    }

    // Build validation rules, omitting undefined values
    const validationRules: Record<string, unknown> = {};
    if (values.validationRules) {
      const { min, max, type, required } = values.validationRules;
      if (min !== undefined) validationRules.min = min;
      if (max !== undefined) validationRules.max = max;
      if (type) validationRules.type = type;
      if (required) validationRules.required = true;
    }

    const basePayload = {
      name: values.name,
      specialty_id: values.specialtyId || undefined,
      units: values.units || undefined,
      methodName: values.methodName.trim(),
      is_confidential: values.isConfidential,
      validationRules:
        Object.keys(validationRules).length > 0 ? validationRules : undefined,
    };

    startTransition(async () => {
      try {
        const result =
          mode === "create"
            ? await createAssayDefinitionClient({
                ...basePayload,
              })
            : await updateAssayDefinitionClient({
                ...basePayload,
                id: assay!.id,
              });

        const returnedAssay = (result as { data?: AssayDefinition })?.data;
        if (returnedAssay) {
          if (mode === "create") {
            onCreated?.(returnedAssay);
          } else {
            onUpdated?.(returnedAssay);
          }
        }

        toast.success(
          mode === "create"
            ? "Đã tạo chỉ tiêu xét nghiệm thành công"
            : "Đã cập nhật chỉ tiêu xét nghiệm thành công",
        );
        resetForm();
        onClose();
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Đã xảy ra lỗi không mong muốn";
        toast.error(message);
      }
    });
  });

  return {
    form,
    isPending,
    methodNameSuggestions,
    loadingMethodNameSuggestions,
    loadMethodNameSuggestions,
    initializeForm,
    resetForm,
    onSubmit,
  };
}
