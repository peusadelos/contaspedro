import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Transaction } from '@/types/financial';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onConfirm: () => void;
  // ✅ NEW: optional custom message for bulk delete
  customMessage?: string;
}

export const DeleteConfirmationDialog = ({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  customMessage,
}: DeleteConfirmationDialogProps) => {
  // ✅ Allow opening without a transaction when customMessage is provided
  if (!transaction && !customMessage) return null;

  const formattedAmount = transaction
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(transaction.amount)
    : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {customMessage ? (
              // ✅ Bulk delete mode: show custom message
              <p>{customMessage}</p>
            ) : (
              // Single delete mode: show transaction details
              <>
                <p>Tem certeza que deseja excluir esta transação?</p>
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-1">
                  <p className="font-semibold">{transaction!.description}</p>
                  <p className="text-sm">
                    Valor: <span className="font-bold">{formattedAmount}</span>
                  </p>
                  <p className="text-sm">Categoria: {transaction!.category}</p>
                </div>
                <p className="text-destructive font-medium mt-4">
                  Esta ação não pode ser desfeita.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
