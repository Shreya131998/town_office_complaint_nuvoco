import { NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { appendToSheet } from '@/lib/googleSheets';
import { sendComplaintEmail } from '@/lib/mailer';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();

    // ─── Extract text fields ───────────────────────────────────────────────
    const name        = formData.get('name')?.toString().trim() || '';
    const quarterNo   = formData.get('quarterNo')?.toString().trim() || '';
    const mobileNo    = formData.get('mobileNo')?.toString().trim() || '';
    const issueType   = formData.get('issueType')?.toString().trim() || '';
    const description = formData.get('description')?.toString().trim() || '';

    // ─── Validate required fields ──────────────────────────────────────────
    if (!name || !quarterNo || !mobileNo || !issueType || !description) {
      return NextResponse.json(
        { success: false, error: 'All required fields must be filled.' },
        { status: 400 }
      );
    }

    // ─── Handle file uploads ───────────────────────────────────────────────
    let photoUrl = '';
    let videoUrl = '';

    const photoFile = formData.get('photo');
    if (photoFile && photoFile.size > 0) {
      const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
      photoUrl = await uploadToCloudinary(photoBuffer, 'town_office/photos', 'image');
    }

    const videoFile = formData.get('video');
    if (videoFile && videoFile.size > 0) {
      const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
      videoUrl = await uploadToCloudinary(videoBuffer, 'town_office/videos', 'video');
    }

    // ─── Timestamp ─────────────────────────────────────────────────────────
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // ─── Append to Google Sheet ────────────────────────────────────────────
    await appendToSheet([
      timestamp,
      name,
      quarterNo,
      mobileNo,
      issueType,
      description,
      photoUrl || 'N/A',
      videoUrl || 'N/A',
    ]);

    // ─── Send email notification ───────────────────────────────────────────
    await sendComplaintEmail({
      name,
      quarterNo,
      mobileNo,
      issueType,
      description,
      photoUrl,
      videoUrl,
      timestamp,
    });

    return NextResponse.json({ success: true, message: 'Complaint submitted successfully!' });
  } catch (error) {
    console.error('[Submit API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
