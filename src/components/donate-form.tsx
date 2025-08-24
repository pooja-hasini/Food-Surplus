'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDonations } from '@/context/DonationsContext';
import { handleCategorize } from '@/actions/categorize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Sparkles, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';

const formSchema = z.object({
  foodName: z.string().min(3, 'Food name must be at least 3 characters.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  expiryDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  location: z.string().min(5, 'Location must be at least 5 characters.'),
  photo: z.any().refine(file => file?.[0], 'A photo is required.'),
});

type FormValues = z.infer<typeof formSchema>;

export function DonateForm() {
  const router = useRouter();
  const { addDonation } = useDonations();
  const { toast } = useToast();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      foodName: '',
      quantity: 1,
      location: '',
    },
  });

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
      setAiTags([]);
      setAiError(null);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setIsCategorizing(true);
        try {
          const result = await handleCategorize(dataUri);
          if ('error' in result) {
            setAiError(result.error);
          } else {
            form.setValue('foodName', result.category, { shouldValidate: true });
            setAiTags(result.tags);
          }
        } catch (error) {
           setAiError('An unexpected error occurred during categorization.');
        } finally {
          setIsCategorizing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (values: FormValues) => {
    if (!photoPreview) {
      toast({ title: "Photo missing", description: "Please upload a photo of the food.", variant: 'destructive'});
      return;
    }
    setIsSubmitting(true);
    addDonation({
      foodName: values.foodName,
      quantity: values.quantity,
      expiryTime: new Date(values.expiryDate),
      location: values.location,
      photoUrl: photoPreview,
      tags: aiTags,
    });
    toast({ title: "Donation Submitted!", description: "Thank you for your generosity. Your donation is now pending." });
    router.push('/donor');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create a New Donation</CardTitle>
        <CardDescription>Fill out the form below to list your surplus food.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="photo">Food Photo</Label>
            <div className="relative">
              <Input id="photo" type="file" accept="image/*" {...form.register('photo')} onChange={handlePhotoChange} className="pr-12"/>
              <Upload className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
            {form.formState.errors.photo && <p className="text-sm text-destructive">{form.formState.errors.photo.message as string}</p>}
          </div>

          {photoPreview && (
            <div className="relative w-full h-64 rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center bg-muted">
              <Image src={photoPreview} alt="Food preview" layout="fill" objectFit="cover" />
              {isCategorizing && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="mt-2">Analyzing image...</p>
                </div>
              )}
            </div>
          )}
          
          {aiError && (
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{aiError}</AlertDescription>
              </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="foodName">Food Name</Label>
            <div className="relative">
                <Input id="foodName" {...form.register('foodName')} placeholder="e.g., Fresh Apples" />
                {!isCategorizing && aiTags.length > 0 && <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-yellow-500" />}
            </div>
            {aiTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                    {aiTags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
            )}
            {form.formState.errors.foodName && <p className="text-sm text-destructive">{form.formState.errors.foodName.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (serves how many?)</Label>
              <Input id="quantity" type="number" {...form.register('quantity')} placeholder="e.g., 5" />
              {form.formState.errors.quantity && <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input id="expiryDate" type="date" {...form.register('expiryDate')} />
              {form.formState.errors.expiryDate && <p className="text-sm text-destructive">{form.formState.errors.expiryDate.message}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Your Location</Label>
            <Textarea id="location" {...form.register('location')} placeholder="e.g., 123 Main St, Anytown" />
            {form.formState.errors.location && <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || isCategorizing}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Donation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
