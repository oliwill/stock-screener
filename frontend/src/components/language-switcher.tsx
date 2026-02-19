"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      {locale === 'zh' ? 'EN' : '简中'}
    </Button>
  );
}
