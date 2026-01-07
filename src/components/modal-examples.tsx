import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDialog } from '@/hooks/useDialog';
import { useModal } from '@/hooks/useModal';
import { DialogProvider } from '@/components/dialog-provider';
import { ModalProvider } from '@/components/modal-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function ModalExamples() {
  const dialog = useDialog();
  const modal = useModal();

  const handleShowAlert = () => {
    dialog.showAlert({
      title: 'Information',
      description: 'This is an alert dialog example.',
    });
  };

  const handleShowConfirm = () => {
    dialog.showConfirmDialog({
      title: 'Confirm Action',
      description: 'Are you sure you want to proceed?',
      variant: 'destructive',
      onConfirm: async () => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Action confirmed');
      },
    });
  };

  const handleShowFormModal = () => {
    const form = (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Enter your name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="Enter your email" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={modal.closeModal}>
            Cancel
          </Button>
          <Button onClick={() => {
            console.log('Form submitted');
            modal.closeModal();
          }}>
            Submit
          </Button>
        </div>
      </div>
    );

    modal.showFormModal(form, {
      title: 'User Information',
      size: 'md',
    });
  };

  const handleShowContentModal = () => {
    const content = (
      <div className="space-y-4">
        <Alert>
          <AlertDescription>
            This is a content modal with custom components.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          You can put any React content here, including complex components,
          forms, images, or any other UI elements.
        </p>
        <Button onClick={modal.closeModal} className="w-full">
          Close Modal
        </Button>
      </div>
    );

    modal.showContentModal(content, {
      title: 'Custom Content',
      size: 'lg',
    });
  };

  const handleShowFullScreenModal = () => {
    const content = (
      <div className="h-full flex flex-col space-y-4">
        <Alert>
          <AlertDescription>
            This is a full-screen modal that takes up the entire viewport.
          </AlertDescription>
        </Alert>
        <div className="flex-1 bg-muted/50 rounded-md p-4 flex items-center justify-center">
          <p className="text-lg text-muted-foreground">
            Full screen content area
          </p>
        </div>
        <Button onClick={modal.closeModal}>
          Close Full Screen Modal
        </Button>
      </div>
    );

    modal.showFullScreenModal(content, {
      title: 'Full Screen Modal',
    });
  };

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Modal Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleShowAlert} className="w-full">
            Show Alert Dialog
          </Button>
          
          <Button onClick={handleShowConfirm} variant="destructive" className="w-full">
            Show Confirm Dialog
          </Button>
          
          <Button onClick={handleShowFormModal} variant="outline" className="w-full">
            Show Form Modal
          </Button>
          
          <Button onClick={handleShowContentModal} variant="secondary" className="w-full">
            Show Content Modal
          </Button>
          
          <Button onClick={handleShowFullScreenModal} variant="ghost" className="w-full">
            Show Full Screen Modal
          </Button>
        </CardContent>
      </Card>

      {/* Dialog Provider for alerts and confirmations */}
      <DialogProvider
        dialog={dialog.dialog}
        onConfirm={dialog.confirm}
        onCancel={dialog.cancel}
      />

      {/* Modal Provider for custom content */}
      <ModalProvider
        modal={modal.modal}
        onClose={modal.closeModal}
      />
    </>
  );
}