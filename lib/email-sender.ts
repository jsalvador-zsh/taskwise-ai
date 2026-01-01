import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendTaskAssignmentEmailParams {
  to: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  assignedBy: string;
  taskUrl: string;
}

export async function sendTaskAssignmentEmail({
  to,
  taskTitle,
  taskDescription,
  dueDate,
  assignedBy,
  taskUrl,
}: SendTaskAssignmentEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'TaskWise <onboarding@resend.dev>', // Cambia esto cuando tengas tu dominio
      to: [to],
      subject: `Nueva tarea asignada: ${taskTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nueva tarea asignada</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">📋 Nueva Tarea Asignada</h1>
            </div>

            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Hola, <strong>${assignedBy}</strong> te ha asignado una nueva tarea en TaskWise:
              </p>

              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                <h2 style="margin-top: 0; color: #667eea; font-size: 20px;">${taskTitle}</h2>
                ${taskDescription ? `<p style="color: #666; margin: 10px 0;">${taskDescription}</p>` : ''}
                ${dueDate ? `
                  <div style="margin-top: 15px; padding: 10px; background-color: #f0f4ff; border-radius: 5px;">
                    <p style="margin: 0; color: #667eea;">
                      <strong>📅 Fecha límite:</strong> ${new Date(dueDate).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                ` : ''}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${taskUrl}"
                   style="display: inline-block; background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                  Ver Tarea
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px;">
                <p>Este es un mensaje automático de TaskWise. Por favor, no respondas a este correo.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log('✅ Email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}
