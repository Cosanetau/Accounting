import { supabase } from '../lib/supabase';

export async function uploadAccountingFile(file, userId, folder) {
  if (!file || !userId) {
    return { receiptPath: '', receiptFilename: '' };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('accounting-receipts').upload(path, file, {
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'File upload failed.');
  }

  return { receiptPath: path, receiptFilename: file.name };
}

export async function openAccountingAttachment(path) {
  const { data, error } = await supabase.storage
    .from('accounting-receipts')
    .createSignedUrl(path, 3600);

  if (error) {
    throw error;
  }

  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
