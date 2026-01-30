import { useState } from 'react';
import {
  RefreshCw,
  Inbox,
  MailOpen,
  FileText,
  Search,
  Filter,
  Star,
  StarIcon,
  Trash2,
  Folder,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Circle,
  Clock,
  X,
  Send,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { useEmailContext, type EmailData, type FolderState } from '../contexts/EmailContext';
import { useToast } from '../contexts/ToastContext';

// API base URL - constructed from environment variables
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '2821';
const API_BASE = `http://localhost:${BACKEND_PORT}`;

/**
 * Detect the optimal width range for email content based on its HTML structure
 * Returns { minWidth, maxWidth } in pixels
 */
function getEmailOptimalWidthRange(html: string): { minWidth: number; maxWidth: number } {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  let minWidth = 280; // Default minimum width for basic content
  let maxWidth = 600; // Default maximum width for typical email content

  // Check for tables with explicit widths
  const tables = temp.querySelectorAll('table');
  for (const table of tables) {
    const widthAttr = table.getAttribute('width');
    const styleAttr = table.getAttribute('style');

    // Check width attribute
    if (widthAttr) {
      if (/^\d+$/.test(widthAttr)) {
        const tableWidth = parseInt(widthAttr);
        minWidth = Math.max(minWidth, tableWidth);
        maxWidth = Math.max(maxWidth, tableWidth);
      } else if (widthAttr.includes('%')) {
        // Percentage widths - assume 600px base for 100%
        const percent = parseInt(widthAttr);
        if (percent <= 100) {
          const calculatedWidth = Math.round(600 * (percent / 100));
          minWidth = Math.max(minWidth, calculatedWidth);
          maxWidth = Math.max(maxWidth, calculatedWidth);
        }
      }
    }

    // Check style attribute for width
    if (styleAttr) {
      const minWidthMatch = styleAttr.match(/min-width:\s*(\d+)px/i);
      if (minWidthMatch) {
        minWidth = Math.max(minWidth, parseInt(minWidthMatch[1]));
      }

      const tableMaxWidthMatch = styleAttr.match(/max-width:\s*(\d+)px/i);
      if (tableMaxWidthMatch) {
        maxWidth = Math.max(maxWidth, parseInt(tableMaxWidthMatch[1]));
      }

      const tableWidthMatch = styleAttr.match(/width:\s*(\d+)px/i);
      if (tableWidthMatch) {
        const tableWidth = parseInt(tableWidthMatch[1]);
        minWidth = Math.max(minWidth, tableWidth);
        maxWidth = Math.max(maxWidth, tableWidth);
      }
    }
  }

  // Check for images with explicit widths
  const images = temp.querySelectorAll('img');
  for (const img of images) {
    const widthAttr = img.getAttribute('width');
    const styleAttr = img.getAttribute('style');

    if (widthAttr && /^\d+$/.test(widthAttr)) {
      const imgWidth = parseInt(widthAttr);
      // Only consider images larger than 100px for minimum width
      if (imgWidth > 100) {
        minWidth = Math.max(minWidth, imgWidth);
      }
      maxWidth = Math.max(maxWidth, imgWidth);
    }

    if (styleAttr) {
      const imgWidthMatch = styleAttr.match(/width:\s*(\d+)px/i);
      if (imgWidthMatch) {
        const imgWidth = parseInt(imgWidthMatch[1]);
        if (imgWidth > 100) {
          minWidth = Math.max(minWidth, imgWidth);
        }
        maxWidth = Math.max(maxWidth, imgWidth);
      }
    }
  }

  // Check for containers with explicit widths (divs, tds, etc.)
  const containers = temp.querySelectorAll('div, td, th');
  for (const container of containers) {
    const styleAttr = container.getAttribute('style');

    if (styleAttr) {
      const minWidthMatch = styleAttr.match(/min-width:\s*(\d+)px/i);
      if (minWidthMatch) {
        minWidth = Math.max(minWidth, parseInt(minWidthMatch[1]));
      }

      const widthMatch = styleAttr.match(/width:\s*(\d+)px/i);
      if (widthMatch) {
        const containerWidth = parseInt(widthMatch[1]);
        // Fixed width containers should influence both min and max
        if (containerWidth > 150) {
          minWidth = Math.max(minWidth, containerWidth);
        }
        maxWidth = Math.max(maxWidth, containerWidth);
      }
    }
  }

  // Add padding to the calculated widths
  const padding = 40;
  minWidth = minWidth + padding;
  maxWidth = maxWidth + padding;

  // Cap max width at 800px for readability
  maxWidth = Math.min(maxWidth, 800);

  // Ensure minimum width is at least 280px but not more than max
  minWidth = Math.max(280, Math.min(minWidth, maxWidth));

  return { minWidth, maxWidth };
}

/**
 * Sanitize and optimize email HTML for display
 * Removes script tags and external stylesheets, but preserves inline styles for layout
 */
function sanitizeEmailHtml(html: string): string {
  // Create a temporary DOM element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove script tags
  const scriptTags = temp.querySelectorAll('script');
  scriptTags.forEach(tag => tag.remove());

  // Remove link tags (external stylesheets)
  const linkTags = temp.querySelectorAll('link[rel="stylesheet"]');
  linkTags.forEach(tag => tag.remove());

  // Remove meta tags
  const metaTags = temp.querySelectorAll('meta');
  metaTags.forEach(tag => tag.remove());

  // Remove noscript tags
  const noscriptTags = temp.querySelectorAll('noscript');
  noscriptTags.forEach(tag => tag.remove());

  // Process images to ensure they don't overflow and icons are properly sized
  const images = temp.querySelectorAll('img');
  images.forEach(img => {
    const widthAttr = img.getAttribute('width');
    const heightAttr = img.getAttribute('height');
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const classAttr = img.getAttribute('class') || '';

    // Parse dimensions
    const width = widthAttr ? parseInt(widthAttr) : 0;
    const height = heightAttr ? parseInt(heightAttr) : 0;
    const maxDim = Math.max(width, height);

    // Detect if this is an avatar/profile photo
    const isAvatar = (
      /avatar|profile|photo|headshot|userpic/i.test(src) ||
      /avatar|profile|photo|headshot|userpic/i.test(alt) ||
      /avatar|profile|photo|headshot|userpic/i.test(classAttr)
    );

    // Detect if this is a small UI icon (navigation, buttons, etc.)
    const isSmallIcon = (
      maxDim > 0 && maxDim <= 24 ||
      /icon|button|nav|badge/i.test(src) ||
      /icon|button|nav|badge/i.test(alt) ||
      /icon|button|nav/i.test(classAttr)
    );

    // Detect if this is a logo (brand or company)
    const isLogo = (
      /logo|brand/i.test(src) ||
      /logo|brand/i.test(alt) ||
      /logo|brand/i.test(classAttr)
    );

    // Detect if this is a QR code
    // Note: exclude "download" alone as it matches app store buttons
    const isQRCode = (
      /qr|qrcode|scan/i.test(src) ||
      /qr|qrcode|scan/i.test(alt) ||
      /qr|qrcode/i.test(classAttr)
    );

    // Detect if this is an app store badge (App Store, Google Play, Microsoft Store)
    // Must have app store related keywords in src or alt, not just class
    const isAppStoreBadge = (
      (/app.?store|google.?play|microsoft|get.?it.?on|download.?on/i.test(src) ||
       /app.?store|google.?play|microsoft|get.?it.?on|download.?on/i.test(alt)) &&
      !/premium|subscribe|try|month/i.test(alt) // Exclude non-app-store buttons
    );

    // Detect if this is a content image that should be displayed larger
    // (e.g., illustrations, charts, diagrams in emails)
    const isContentImage = (
      width >= 50 && height >= 50 &&
      !isAvatar && !isSmallIcon && !isLogo && !isQRCode && !isAppStoreBadge
    );

    // Check if image is in a center-aligned container
    // Need to check the style attribute string, not element.style property
    const checkElementCentered = (element: HTMLElement | null): boolean => {
      if (!element) return false;

      // Check align attribute
      if (element.getAttribute('align') === 'center') {
        return true;
      }

      // Check style attribute string (not element.style property!)
      const styleAttr = element.getAttribute('style') || '';
      if (styleAttr.includes('text-align') && /text-align\s*:\s*center/i.test(styleAttr)) {
        return true;
      }

      // Check for margin-based centering
      if (/margin\s*:\s*.*auto/i.test(styleAttr) ||
          (styleAttr.includes('margin-left') && /margin-left\s*:\s*auto/i.test(styleAttr))) {
        return true;
      }

      // Check tag name for <center> tag
      if (element.tagName === 'CENTER') {
        return true;
      }

      return false;
    };

    // Check current parent and traverse up to find centering
    let currentParent = img.parentElement;
    let isCentered = false;
    let centeredParent: HTMLElement | null = null;

    // Check up to 4 levels up for centering (emails often have nested tables)
    // Also skip <a> tags when checking - they don't affect layout
    for (let i = 0; i < 4 && currentParent; i++) {
      // Skip anchor tags - they don't affect centering
      if (currentParent.tagName !== 'A' && checkElementCentered(currentParent)) {
        isCentered = true;
        centeredParent = currentParent;
        break;
      }
      currentParent = currentParent.parentElement;
    }

    // Special case: if immediate parent is a centered cell but we skipped it,
    // check one more level
    if (!isCentered && img.parentElement && img.parentElement.tagName === 'A') {
      const anchorParent = img.parentElement.parentElement;
      if (anchorParent && checkElementCentered(anchorParent)) {
        isCentered = true;
        centeredParent = anchorParent;
      }
    }

    // Apply centering if parent is centered
    const applyCentering = () => {
      if (isCentered) {
        const currentStyle = img.getAttribute('style') || '';

        // Check if image already has display: block with margin auto (already centered)
        const hasBlockWithMarginAuto = /display\s*:\s*block/i.test(currentStyle) &&
                                      (/margin\s*:\s*.*auto/i.test(currentStyle) ||
                                       (/margin-left\s*:\s*auto/i.test(currentStyle) && /margin-right\s*:\s*auto/i.test(currentStyle)));

        // Only set display if not already set to block with margin auto
        if (!hasBlockWithMarginAuto && !/display\s*:/i.test(currentStyle)) {
          img.style.display = 'inline-block';
        }

        // For table cells, also apply vertical alignment
        if (centeredParent && (centeredParent.tagName === 'TD' || centeredParent.tagName === 'TH')) {
          if (!/vertical-align\s*:/i.test(currentStyle)) {
            img.style.verticalAlign = 'middle';
          }
        }

        // If the parent is a table cell with text-align: center, the image should be inline
        if (centeredParent && (centeredParent.tagName === 'TD' || centeredParent.tagName === 'TH')) {
          const parentStyle = centeredParent.getAttribute('style') || '';
          if (/text-align\s*:\s*center/i.test(parentStyle) && !/display\s*:/i.test(currentStyle)) {
            img.style.display = 'inline-block';
          }
        }
      }
    };

    // Preserve original aspect ratio by not setting explicit width/height
    // Only set max constraints to prevent overflow
    if (isAvatar) {
      // For avatars/profile photos
      img.style.maxWidth = '100px';
      img.style.maxHeight = '100px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '50%';
      applyCentering();
    } else if (isSmallIcon) {
      // For small UI icons - preserve aspect ratio with max constraints
      img.style.maxWidth = '24px';
      img.style.maxHeight = '24px';
      img.style.objectFit = 'contain';
      applyCentering();
    } else if (isLogo) {
      // For all logos - preserve aspect ratio with max constraints
      img.style.maxHeight = '40px';
      img.style.width = 'auto';
      img.style.objectFit = 'contain';
      img.style.flexShrink = '0';
      applyCentering();
    } else if (isQRCode) {
      // For QR codes - preserve aspect ratio with max constraints
      img.style.maxWidth = '120px';
      img.style.maxHeight = '120px';
      img.style.objectFit = 'contain';
      applyCentering();
    } else if (isAppStoreBadge) {
      // For app store badges - preserve aspect ratio with max constraints
      img.style.maxHeight = '40px';
      img.style.width = 'auto';
      img.style.objectFit = 'contain';
      applyCentering();
    } else if (isContentImage) {
      // For content images - allow reasonable size but prevent overflow
      img.style.maxWidth = '100%';
      img.style.maxHeight = '400px';
      img.style.objectFit = 'contain';
      applyCentering();
    } else {
      // For other images - responsive default
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      applyCentering();
    }
  });

  // Process tables to ensure they don't overflow and reduce excessive spacing
  const tables = temp.querySelectorAll('table');
  tables.forEach(table => {
    // Only set max-width if not already set
    const existingStyle = table.getAttribute('style') || '';
    if (!existingStyle.includes('max-width')) {
      table.style.maxWidth = '100%';
    }

    // Check if table should be centered
    const tableAlign = table.getAttribute('align');
    const tableStyle = table.getAttribute('style') || '';
    const isTableCentered = tableAlign === 'center' ||
                           (tableStyle.includes('margin') && /margin\s*:\s*.*auto/i.test(tableStyle));

    if (isTableCentered) {
      table.style.marginLeft = 'auto';
      table.style.marginRight = 'auto';
    }
  });

  // Process table rows to reduce excessive height/spacing
  const rows = temp.querySelectorAll('tr');
  rows.forEach(row => {
    // Check if row has excessive height from line-height or padding
    const cells = row.querySelectorAll('td, th');
    cells.forEach(cell => {
      // Get computed style to check for excessive padding
      const padding = cell.getAttribute('padding');
      if (padding) {
        const paddingVal = parseInt(padding);
        if (paddingVal > 12) {
          cell.setAttribute('padding', '8');
        }
      }
      // Check style attribute for padding and background
      const style = cell.getAttribute('style') || '';
      let newStyle = style;
      
      if (style.includes('padding')) {
        // Reduce padding values in inline styles
        newStyle = newStyle
          .replace(/padding:\s*(\d+)px/g, (match, val) => {
            const num = parseInt(val);
            return num > 12 ? `padding: ${Math.floor(num * 0.5)}px` : match;
          })
          .replace(/padding-(top|bottom):\s*(\d+)px/g, (match, dir, val) => {
            const num = parseInt(val);
            return num > 8 ? `padding-${dir}: ${Math.floor(num * 0.5)}px` : match;
          });
      }
      
      // Remove gray background colors from cells that contain only images
      const cellImages = cell.querySelectorAll('img');
      const cellText = cell.textContent?.trim() || '';
      if (cellImages.length > 0 && cellText === '') {
        // Cell contains only images, remove background color
        newStyle = newStyle.replace(/background-color\s*:\s*[^;]+;?/gi, '');
        newStyle = newStyle.replace(/background\s*:\s*[^;]+;?/gi, '');
      }
      
      if (newStyle !== style) {
        cell.setAttribute('style', newStyle);
      }
    });
  });

  // Process all elements with center alignment to preserve it
  const centerAlignedElements = temp.querySelectorAll('[align="center"], center, [style*="text-align: center"], [style*="text-align:center"], [style*="margin: 0 auto"], [style*="margin-left: auto"]');
  centerAlignedElements.forEach(el => {
    const style = el.getAttribute('style') || '';

    // Preserve text-align: center
    if (/text-align\s*:\s*center/i.test(style)) {
      el.style.textAlign = 'center';
    }

    // Preserve margin-based centering
    if (/margin\s*:\s*.*auto/i.test(style) ||
        (/margin-left\s*:\s*auto/i.test(style) && /margin-right\s*:\s*auto/i.test(style))) {
      el.style.marginLeft = 'auto';
      el.style.marginRight = 'auto';
    }

    // For elements with align="center" attribute
    if (el.getAttribute('align') === 'center') {
      el.style.textAlign = 'center';
    }
  });

  // Process divs that might have excessive margins
  const divs = temp.querySelectorAll('div');
  divs.forEach(div => {
    const style = div.getAttribute('style') || '';
    if (style.includes('margin')) {
      // Reduce margin values
      const newStyle = style
        .replace(/margin:\s*(\d+)px/g, (match, val) => {
          const num = parseInt(val);
          return num > 16 ? `margin: ${Math.floor(num * 0.5)}px` : match;
        })
        .replace(/margin-(top|bottom):\s*(\d+)px/g, (match, dir, val) => {
          const num = parseInt(val);
          return num > 8 ? `margin-${dir}: ${Math.floor(num * 0.5)}px` : match;
        });
      if (newStyle !== style) {
        div.setAttribute('style', newStyle);
      }
    }
  });

  // Process all links to open in new tab and remove underline styling
  const links = temp.querySelectorAll('a');
  links.forEach(link => {
    // Set target to _blank to open in new tab
    link.setAttribute('target', '_blank');
    // Set rel for security
    link.setAttribute('rel', 'noopener noreferrer');
    // Remove underline styling from links (but preserve box-shadow for buttons)
    const currentStyle = link.getAttribute('style') || '';
    if (!currentStyle.includes('box-shadow')) {
      link.style.textDecoration = 'none';
      link.style.borderBottom = 'none';
    }
  });

  // Process reply/forward email headers to improve visual formatting
  // Look for common patterns like "From:", "Sent:", "To:", "Subject:" in text
  const allElements = temp.querySelectorAll('div, p, span, td');
  allElements.forEach(el => {
    const text = el.textContent || '';
    // Check if this element contains email header pattern
    // Use simpler check - just look for multiple header keywords
    const hasChineseHeaders = (text.includes('发件人') || text.includes('发送时间')) &&
                               (text.includes('收件人') || text.includes('主题'));
    const hasEnglishHeaders = (text.includes('From:') || text.includes('From：')) &&
                               (text.includes('To:') || text.includes('To：') || text.includes('Sent:') || text.includes('Sent：'));

    if (hasChineseHeaders || hasEnglishHeaders) {
      // Add styling to make headers more readable
      // Format headers with line breaks for better readability
      let formattedHtml = el.innerHTML;

      // Replace Chinese header separators with line breaks (but not before the first one)
      formattedHtml = formattedHtml
        .replace(/(发送时间[：:])/g, '<br>$1')
        .replace(/(收件人[：:])/g, '<br>$1')
        .replace(/(主题[：:])/g, '<br>$1');

      // Replace English header separators with line breaks (but not before the first one)
      formattedHtml = formattedHtml
        .replace(/(Sent[：:])/gi, '<br>$1')
        .replace(/(To[：:])/gi, '<br>$1')
        .replace(/(Subject[：:])/gi, '<br>$1');

      // Only update if we actually made changes
      if (formattedHtml !== el.innerHTML) {
        el.innerHTML = formattedHtml;
        el.style.borderLeft = '3px solid #e5e7eb';
        el.style.paddingLeft = '12px';
        el.style.marginLeft = '0';
        el.style.marginTop = '8px';
        el.style.marginBottom = '8px';
        el.style.color = '#6b7280';
        el.style.fontSize = '14px';
        el.style.lineHeight = '1.4';
      }
    }
  });

  // Process horizontal rules or separator lines
  const hrs = temp.querySelectorAll('hr');
  hrs.forEach(hr => {
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid #e5e7eb';
    hr.style.margin = '8px 0';
  });

  return temp.innerHTML;
}

type FilterType = 'all' | 'unread' | 'starred';
type ComposeMode = 'reply' | 'forward' | 'compose';

interface ComposeState {
  isOpen: boolean;
  mode: ComposeMode;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  originalEmail?: EmailData;
  aiInstructions?: string;
}

export function EmailPage() {
  // Use email context for shared state
  const {
    folderStates,
    fetchEmailsForFolder,
    reloadFolder,
    updateEmailAcrossFolders,
    removeEmailFromFolders,
    moveEmailToFolder,
    isLoading,
  } = useEmailContext();

  // Use toast for notifications
  const { showSuccess, showError, showWarning } = useToast();

  const [selectedFolder, setSelectedFolder] = useState<string>('INBOX');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Compose modal state
  const [composeState, setComposeState] = useState<ComposeState>({
    isOpen: false,
    mode: 'compose',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    aiInstructions: '',
  });
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [copiedEmailUid, setCopiedEmailUid] = useState<number | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);

  // Move to folder modal state
  const [moveFolderState, setMoveFolderState] = useState<{
    isOpen: boolean;
    emailUid: number | null;
    selectedFolder: string;
  }>({
    isOpen: false,
    emailUid: null,
    selectedFolder: '',
  });
  const [movingEmail, setMovingEmail] = useState<boolean>(false);

  // Copy raw email content to clipboard
  const handleCopyRawContent = async (email: EmailData) => {
    try {
      // Copy complete RFC822 raw email (including all headers and body)
      // This is the original email as received from IMAP server
      const rawContent = email.raw || email.html || email.text || '';
      await navigator.clipboard.writeText(rawContent);
      setCopiedEmailUid(email.uid);
      showSuccess('Raw RFC822 email content copied to clipboard');

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedEmailUid(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showError('Failed to copy email content');
    }
  };

  // Flag email (mark as read/unread or star/unstar)
  const flagEmail = async (emailUid: number, flagType: string, value: boolean) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/emails/${emailUid}/flag?flag_type=${flagType}&value=${value}`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (data.status === 'success') {
        // Update local state across all folders
        updateEmailAcrossFolders(emailUid, (email) => {
          if (flagType === 'seen') {
            return { ...email, isUnread: !value };
          } else if (flagType === 'flagged') {
            return { ...email, isFlagged: value };
          }
          return email;
        });
      } else {
        setErrorMessage(data.detail || 'Failed to update email');
      }
    } catch (error) {
      console.error('Failed to flag email:', error);
      setErrorMessage('Failed to update email');
    }
  };

  // Delete email
  const deleteEmail = async (emailUid: number) => {
    if (!confirm('Are you sure you want to delete this email?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/emails/${emailUid}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Remove from local state across all folders
        removeEmailFromFolders(emailUid);
        setExpandedEmail(null);
      } else {
        setErrorMessage(data.detail || 'Failed to delete email');
      }
    } catch (error) {
      console.error('Failed to delete email:', error);
      setErrorMessage('Failed to delete email');
    }
  };

  // Open compose modal for reply
  const handleReply = (email: EmailData) => {
    const fromEmail = email.fromName && email.fromName !== email.from
      ? `${email.fromName} <${email.from}>`
      : email.from;

    setComposeState({
      isOpen: true,
      mode: 'reply',
      to: fromEmail,
      cc: '',
      bcc: '',
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---------- Original Message ----------\nFrom: ${email.fromName || email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n`,
      originalEmail: email,
      aiInstructions: '',
    });
  };

  // Open compose modal for forward
  const handleForward = (email: EmailData) => {
    setComposeState({
      isOpen: true,
      mode: 'forward',
      to: '',
      cc: '',
      bcc: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---------- Forwarded Message ----------\nFrom: ${email.fromName || email.from}\nDate: ${email.date}\nSubject: ${email.subject}\nTo: ${email.to.join(', ')}\n\n`,
      originalEmail: email,
    });
  };

  // Open move to folder modal
  const handleOpenMoveFolder = (emailUid: number) => {
    setMoveFolderState({
      isOpen: true,
      emailUid: emailUid,
      selectedFolder: '',
    });
  };

  // Move email to selected folder
  const handleMoveToFolder = async () => {
    const { emailUid, selectedFolder } = moveFolderState;

    console.log('[Move Email] Starting move operation:', { emailUid, selectedFolder });

    if (!emailUid || !selectedFolder) {
      showWarning('Please select a folder');
      return;
    }

    try {
      setMovingEmail(true);

      const url = `${API_BASE}/api/emails/${emailUid}/move?destination_folder=${encodeURIComponent(selectedFolder)}`;
      console.log('[Move Email] Sending request to:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[Move Email] Response status:', response.status);
      console.log('[Move Email] Response ok:', response.ok);

      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('[Move Email] Error response:', errorData);
        showError(errorData.detail || `Failed to move email (HTTP ${response.status})`);
        return;
      }

      const data = await response.json();
      console.log('[Move Email] Success response:', data);

      if (data.status === 'success') {
        // Move email to target folder in local state
        moveEmailToFolder(emailUid, selectedFolder);
        setExpandedEmail(null);
        setMoveFolderState({ isOpen: false, emailUid: null, selectedFolder: '' });
        showSuccess(`Email moved to ${selectedFolder}`);
      } else {
        showError(data.detail || 'Failed to move email');
      }
    } catch (error) {
      console.error('[Move Email] Exception caught:', error);
      showError('Failed to move email. Please try again.');
    } finally {
      setMovingEmail(false);
      console.log('[Move Email] Move operation completed');
    }
  };

  // Generate AI reply/compose
  const handleAIReply = async () => {
    try {
      setIsGeneratingAI(true);

      // Only send original_email for reply and forward modes
      const shouldSendOriginalEmail = composeState.mode === 'reply' || composeState.mode === 'forward';

      const response = await fetch(`${API_BASE}/api/emails/ai-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: composeState.mode,
          original_email: shouldSendOriginalEmail && composeState.originalEmail ? {
            from: composeState.originalEmail.from,
            from_name: composeState.originalEmail.fromName,
            subject: composeState.originalEmail.subject,
            body: composeState.originalEmail.body,
            date: composeState.originalEmail.date,
          } : null,
          to: composeState.to,
          subject: composeState.subject,
          instructions: composeState.aiInstructions || '',
        }),
      });

      const data = await response.json();

      if (data.status === 'success' && data.reply) {
        // Set AI-generated content to body
        setComposeState({ ...composeState, body: data.reply });
        showSuccess(
          composeState.mode === 'reply'
            ? 'AI reply generated successfully!'
            : composeState.mode === 'forward'
            ? 'AI forwarding message generated successfully!'
            : 'Email drafted successfully!'
        );
      } else {
        showError(data.detail || data.message || 'Failed to generate AI content');
      }
    } catch (error) {
      console.error('Failed to generate AI content:', error);
      showError('Failed to generate AI content');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Send email
  const handleSendEmail = async () => {
    if (!composeState.to.trim()) {
      showWarning('Please enter a recipient');
      return;
    }

    if (!composeState.subject.trim()) {
      showWarning('Please enter a subject');
      return;
    }

    try {
      setSendingEmail(true);

      const formData = new FormData();
      formData.append('to', composeState.to);
      formData.append('cc', composeState.cc);
      formData.append('bcc', composeState.bcc);
      formData.append('subject', composeState.subject);
      formData.append('body', composeState.body);
      formData.append('html', 'false');

      const response = await fetch(`${API_BASE}/api/emails/send`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Close modal
        setComposeState({
          isOpen: false,
          mode: 'compose',
          to: '',
          cc: '',
          bcc: '',
          subject: '',
          body: '',
        });
        showSuccess('Email sent successfully!');
      } else {
        showError(`Failed to send email: ${data.detail || data.message}`);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      showError('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  // Note: We don't need useEffect for initial load or selectedFolder because:
  // 1. EmailContext automatically loads all folders when the app starts
  // 2. When user selects a folder, it's already loaded (or loading)
  // 3. The UI just switches to display the cached data
  // This prevents duplicate loading requests

  // Get current folder state
  const currentFolderState = folderStates[selectedFolder] || {
    name: selectedFolder,
    flags: [],
    emails: [],
    loadStatus: 'unloaded',
    unreadCount: 0,
    totalCount: 0,
  };

  // Filter emails by search query and filter type
  const filteredEmails = currentFolderState.emails
    .filter((email) => {
      // Apply filter
      if (filter === 'unread' && !email.isUnread) return false;
      if (filter === 'starred' && !email.isFlagged) return false;

      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          email.subject.toLowerCase().includes(query) ||
          email.from.toLowerCase().includes(query) ||
          email.fromName.toLowerCase().includes(query) ||
          email.body.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by date, newest first
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Get human-readable folder name
  // This function preserves the original folder names from the server
  // Only applies minimal formatting for readability
  const getFolderDisplayName = (folderName: string): string => {
    // For INBOX, always show as "Inbox" (this is the only exception)
    if (folderName.toLowerCase() === 'inbox') {
      return 'Inbox';
    }

    // For folders with namespaces (e.g., [Gmail]/, [Yahoo]/), extract the local name
    // This preserves the user's language setting
    const namespaceMatch = folderName.match(/^\[([^\]]+)\]\/(.+)$/);
    if (namespaceMatch) {
      // Return the part after the namespace (preserves original name)
      // e.g., "[Gmail]/垃圾邮件" → "垃圾邮件"
      //      "[Gmail]/Spam" → "Spam"
      return namespaceMatch[2];
    }

    // For nested folders (e.g., "Archive/2024"), show the full path
    if (folderName.includes('/')) {
      return folderName;
    }

    // For simple folder names, just capitalize first letter
    return folderName.charAt(0).toUpperCase() + folderName.slice(1);
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Get folder icon based on load status
  const getFolderIcon = (folderState: FolderState) => {
    switch (folderState.loadStatus) {
      case 'unloaded':
        return <Circle className="w-4 h-4 text-gray-300" />;
      case 'loading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'loaded':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-gray-50">
      {/* Sidebar - Folders */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Compose button */}
        <div className="p-4">
          <button
            className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-full py-3 px-6 flex items-center justify-center gap-2 shadow-sm transition-colors font-medium"
            onClick={() => {
              setComposeState({
                isOpen: true,
                mode: 'compose',
                to: '',
                cc: '',
                bcc: '',
                subject: '',
                body: '',
              });
            }}
          >
            <FileText className="w-5 h-5" />
            Compose
          </button>
        </div>

        {/* Folders list */}
        <div className="flex-1 overflow-y-auto px-2">
          {/* All folders - display dynamically based on actual folder list from server */}
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading folders...
            </div>
          ) : (
            <div className="space-y-1">
              {/* Display all folders from the server */}
              {Object.values(folderStates).map(folderState => {
                // Get display name - use common folder name mappings
                let displayName = getFolderDisplayName(folderState.name);

                return (
                  <button
                    key={folderState.name}
                    onClick={() => {
                      setSelectedFolder(folderState.name);
                      setFilter('all');
                    }}
                    disabled={folderState.loadStatus !== 'loaded' && folderState.loadStatus !== 'loading'}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedFolder === folderState.name
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    } ${
                      folderState.loadStatus !== 'loaded' && folderState.loadStatus !== 'loading'
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    {getFolderIcon(folderState)}
                    <span className="flex-1 text-left truncate" title={displayName}>
                      {displayName}
                    </span>
                    {folderState.loadStatus === 'loaded' && folderState.unreadCount > 0 && (
                      <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {folderState.unreadCount}
                      </span>
                    )}
                    {folderState.loadStatus === 'loading' && (
                      <span className="text-xs text-gray-400">Loading...</span>
                    )}
                    {folderState.loadStatus === 'error' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          reloadFolder(folderState.name);
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Retry
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedFolder === '[Gmail]/Starred' && 'Starred'}
              {selectedFolder === '[Gmail]/Sent' && 'Sent'}
              {selectedFolder === '[Gmail]/Drafts' && 'Drafts'}
              {selectedFolder === 'INBOX' && 'Inbox'}
              {!selectedFolder.startsWith('[Gmail]') && selectedFolder !== 'INBOX' && selectedFolder}
            </h2>

            {/* Status indicator */}
            {currentFolderState.loadStatus === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading emails...
              </div>
            )}
            {currentFolderState.loadStatus === 'loaded' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
              </div>
            )}
            {currentFolderState.loadStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                Error loading emails
              </div>
            )}
          </div>

          {/* Search and filter bar */}
          <div className="flex items-center gap-4">
            {/* Search box */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === 'starred'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Starred
              </button>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => reloadFolder(selectedFolder)}
              disabled={currentFolderState.loadStatus === 'loading'}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${currentFolderState.loadStatus === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage('')}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {currentFolderState.loadStatus === 'loading' ? (
            // Skeleton loading
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : currentFolderState.loadStatus === 'error' ? (
            // Error state
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <p className="text-lg font-medium">Failed to load emails</p>
                <p className="text-sm mb-4">Please check your connection and try again</p>
                <button
                  onClick={() => reloadFolder(selectedFolder)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : currentFolderState.loadStatus === 'unloaded' ? (
            // Unloaded state
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium">Folder not loaded yet</p>
                <p className="text-sm mb-4">Click below to load emails</p>
                <button
                  onClick={() => fetchEmailsForFolder(selectedFolder)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Load Emails
                </button>
              </div>
            </div>
          ) : filteredEmails.length === 0 ? (
            // Empty state
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <MailOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium">No emails found</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'Try a different search term'
                    : filter !== 'all'
                    ? 'Try changing the filter'
                    : 'This folder is empty'}
                </p>
              </div>
            </div>
          ) : (
            // Email list
            <div className="divide-y divide-gray-200 w-full">
              {filteredEmails.map((email) => (
                <div
                  key={email.uid}
                  className={`w-full bg-white hover:bg-gray-50 transition-colors ${
                    email.isUnread ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setExpandedEmail(expandedEmail === email.uid ? null : email.uid);

                      if (email.isUnread && expandedEmail !== email.uid) {
                        flagEmail(email.uid, 'seen', true);
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Star button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          flagEmail(email.uid, 'flagged', !email.isFlagged);
                        }}
                        className="flex-shrink-0 mt-1 hover:bg-gray-100 rounded p-1 transition-colors"
                      >
                        {email.isFlagged ? (
                          <StarIcon className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <Star className="w-5 h-5 text-gray-300 hover:text-yellow-400" />
                        )}
                      </button>

                      {/* Email thumbnail - show first letter of sender or subject */}
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-semibold ${
                          email.isUnread
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {email.fromName && email.fromName.length > 0
                            ? email.fromName.charAt(0).toUpperCase()
                            : email.from && email.from.length > 0
                            ? email.from.charAt(0).toUpperCase()
                            : email.subject && email.subject.length > 0
                            ? email.subject.charAt(0).toUpperCase()
                            : '?'}
                        </div>
                      </div>

                      {/* Email content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {email.isUnread && (
                              <div className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0"></div>
                            )}

                            <span
                              className={`font-medium truncate ${
                                email.isUnread ? 'text-gray-900' : 'text-gray-600'
                              }`}
                            >
                              {email.fromName
                                ? `${email.fromName} <${email.from}>`
                                : email.from}
                            </span>
                          </div>

                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {formatDate(email.date)}
                          </span>

                          <div className="ml-2">
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${
                                expandedEmail === email.uid ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>

                        <div
                          className={`text-sm mb-1 truncate ${
                            email.isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'
                          }`}
                        >
                          {email.subject || '(No Subject)'}
                        </div>

                        <div className="text-sm text-gray-500 truncate mb-1">
                          {email.preview || email.body}
                        </div>

                        {email.attachments && email.attachments.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <FileText className="w-4 h-4" />
                            <span>
                              {email.attachments.length} attachment
                              {email.attachments.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedEmail === email.uid && (() => {
                    const widthRange = getEmailOptimalWidthRange(email.body);
                    return (
                        <div className="border-t border-gray-200 p-3 bg-gray-50 w-full">
                          {/* Email headers - centered alignment with body */}
                          <div
                            className="mb-2 text-sm w-full bg-white rounded-lg p-3 shadow-sm border border-gray-100"
                            style={{
                              minWidth: `${widthRange.minWidth}px`,
                              maxWidth: `${widthRange.maxWidth}px`,
                              margin: '0 auto',
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-600 flex-shrink-0 w-16 text-sm">From:</span>
                              <span className="text-gray-900 break-all flex-1">{email.fromName || email.from}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-600 flex-shrink-0 w-16 text-sm">To:</span>
                              <span className="text-gray-900 break-all flex-1">{email.to.join(', ')}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-600 flex-shrink-0 w-16 text-sm">Date:</span>
                              <span className="text-gray-900 break-all flex-1">{email.date}</span>
                            </div>
                          </div>

                      {/* Email body - render HTML content safely */}
                      <div className="mb-2 w-full">
                        <div className="relative group">
                          {/* Copy raw content button */}
                          {email.body && email.body.trim() && (
                            <button
                              onClick={() => handleCopyRawContent(email)}
                              className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-medium rounded-md shadow-lg flex items-center gap-1.5"
                              title="Copy raw HTML content"
                            >
                              {copiedEmailUid === email.uid ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy Raw
                                </>
                              )}
                            </button>
                          )}

                          {/* Email content or empty state message */}
                          {email.body && email.body.trim() ? (
                            <div
                              className="email-body-content w-full bg-white rounded-lg p-3 shadow-sm border border-gray-100"
                              style={{
                                minWidth: `${widthRange.minWidth}px`,
                                maxWidth: `${widthRange.maxWidth}px`,
                                margin: '0 auto',
                              }}
                              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(email.body) }}
                            />
                          ) : (
                            <div className="email-body-content w-full bg-white rounded-lg p-6 text-center text-gray-500">
                              <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm">This email has no text content</p>
                              {email.attachments && email.attachments.length > 0 && (
                                <p className="text-xs mt-1">Only attachments are included</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Global styles for email content */}
                      <style>{`
                        .email-body-content img {
                          max-width: 100%;
                          height: auto;
                        }
                        .email-body-content table {
                          border-spacing: 0;
                        }
                        .email-body-content td {
                          padding: 4px 8px;
                        }
                        .email-body-content tr {
                          height: auto;
                        }
                        /* Preserve center alignment for images and other elements */
                        .email-body-content [align="center"] {
                          text-align: center !important;
                        }
                        .email-body-content [align="center"] img,
                        .email-body-content [align="center"] button,
                        .email-body-content [align="center"] a {
                          display: inline-block;
                        }
                        .email-body-content [align="center"] td {
                          text-align: center !important;
                        }
                        /* Handle <center> tag */
                        .email-body-content center {
                          text-align: center !important;
                          display: block;
                        }
                        .email-body-content center img,
                        .email-body-content center button {
                          display: inline-block;
                        }
                        /* Handle CSS-based centering with text-align */
                        .email-body-content td[style*="text-align: center"],
                        .email-body-content td[style*="text-align:center"],
                        .email-body-content th[style*="text-align: center"],
                        .email-body-content th[style*="text-align:center"] {
                          text-align: center !important;
                        }
                        .email-body-content td[style*="text-align: center"] img,
                        .email-body-content td[style*="text-align:center"] img,
                        .email-body-content td[style*="text-align: center"] button,
                        .email-body-content td[style*="text-align:center"] button,
                        .email-body-content th[style*="text-align: center"] img,
                        .email-body-content th[style*="text-align:center"] img {
                          display: inline-block !important;
                        }
                        /* Handle margin-based centering */
                        .email-body-content img[style*="margin-left: auto"],
                        .email-body-content img[style*="margin-left:auto"],
                        .email-body-content img[style*="margin:0 auto"],
                        .email-body-content img[style*="margin: 0 auto"] {
                          display: block !important;
                          margin-left: auto !important;
                          margin-right: auto !important;
                        }
                        /* Center images in paragraph tags */
                        .email-body-content p[style*="text-align: center"] img,
                        .email-body-content p[style*="text-align:center"] img,
                        .email-body-content p[align="center"] img {
                          display: inline-block !important;
                        }
                        /* Center buttons in containers */
                        .email-body-content div[style*="text-align: center"] button,
                        .email-body-content div[style*="text-align:center"] button,
                        .email-body-content div[align="center"] button,
                        .email-body-content td[style*="text-align: center"] button,
                        .email-body-content td[style*="text-align:center"] button {
                          display: inline-block !important;
                        }
                        /* Preserve text-align center on div and p elements */
                        .email-body-content div[style*="text-align: center"],
                        .email-body-content div[style*="text-align:center"],
                        .email-body-content p[style*="text-align: center"],
                        .email-body-content p[style*="text-align:center"] {
                          text-align: center !important;
                        }
                        /* Ensure inline elements in centered containers are properly centered */
                        /* Only apply to specific elements that need it, not all children */
                        .email-body-content div[style*="text-align: center"] > img,
                        .email-body-content div[style*="text-align:center"] > img,
                        .email-body-content p[style*="text-align: center"] > img,
                        .email-body-content p[style*="text-align:center"] > img,
                        .email-body-content div[style*="text-align: center"] > a,
                        .email-body-content div[style*="text-align:center"] > a,
                        .email-body-content p[style*="text-align: center"] > a,
                        .email-body-content p[style*="text-align:center"] > a {
                          display: inline-block;
                        }
                        /* Handle images wrapped in links inside centered containers */
                        .email-body-content [align="center"] a,
                        .email-body-content [style*="text-align: center"] a,
                        .email-body-content center a {
                          display: inline-block;
                        }
                        .email-body-content [align="center"] a img,
                        .email-body-content [style*="text-align: center"] a img,
                        .email-body-content center a img {
                          display: block;
                        }
                        /* Remove underline on hover for all links and icons */
                        .email-body-content a,
                        .email-body-content a *,
                        .email-body-content a img {
                          text-decoration: none !important;
                          border-bottom: none !important;
                          box-shadow: none !important;
                        }
                        .email-body-content a:hover,
                        .email-body-content a:hover *,
                        .email-body-content a:hover img {
                          text-decoration: none !important;
                          border-bottom: none !important;
                          box-shadow: none !important;
                        }
                        /* Handle double line breaks in quoted emails - convert to single */
                        .email-body-content blockquote br {
                          display: none;
                        }
                        .email-body-content blockquote br + br {
                          display: block;
                        }
                        /* Styles for quoted email headers in replies */
                        .email-body-content blockquote {
                          margin: 8px 0;
                          padding: 6px 10px;
                          border-left: 3px solid #d1d5db;
                          background-color: #f9fafb;
                          color: #4b5563;
                          font-size: 14px;
                        }
                        .email-body-content hr {
                          border: none;
                          border-top: 1px solid #e5e7eb;
                          margin: 8px 0;
                        }
                        /* Gmail/Outlook style quoted content */
                        .email-body-content .gmail_quote,
                        .email-body-content .OutlookMessageHeader {
                          border-left: 3px solid #d1d5db;
                          padding-left: 10px;
                          margin: 8px 0;
                          color: #6b7280;
                        }
                      `}</style>

                      {email.attachments && email.attachments.length > 0 && (
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">
                            Attachments ({email.attachments.length}):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {email.attachments.map((att, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <FileText className="w-4 h-4 text-gray-400" />
                                <div className="text-sm">
                                  <div className="font-medium text-gray-700">{att.filename}</div>
                                  <div className="text-xs text-gray-500">{formatFileSize(att.size)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                          onClick={() => handleReply(email)}
                        >
                          Reply
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                          onClick={() => handleForward(email)}
                        >
                          Forward
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                          onClick={() => handleOpenMoveFolder(email.uid)}
                        >
                          <Folder className="w-4 h-4 inline mr-1" />
                          Move to
                        </button>
                        <button
                          className="px-4 py-2 text-sm bg-white border border-gray-300 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors font-medium"
                          onClick={() => deleteEmail(email.uid)}
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                );
              })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {composeState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">
                {composeState.mode === 'reply' ? 'Reply to Email' :
                 composeState.mode === 'forward' ? 'Forward Email' :
                 'New Email'}
              </h3>
              <button
                onClick={() => setComposeState({ ...composeState, isOpen: false })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* To Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To:
                  </label>
                  <input
                    type="text"
                    value={composeState.to}
                    onChange={(e) => setComposeState({ ...composeState, to: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="recipient@example.com"
                  />
                </div>

                {/* CC Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CC:
                  </label>
                  <input
                    type="text"
                    value={composeState.cc}
                    onChange={(e) => setComposeState({ ...composeState, cc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="cc@example.com"
                  />
                </div>

                {/* BCC Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BCC:
                  </label>
                  <input
                    type="text"
                    value={composeState.bcc}
                    onChange={(e) => setComposeState({ ...composeState, bcc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="bcc@example.com"
                  />
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject:
                  </label>
                  <input
                    type="text"
                    value={composeState.subject}
                    onChange={(e) => setComposeState({ ...composeState, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Email subject"
                  />
                </div>

                {/* Body Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message:
                  </label>
                  <textarea
                    value={composeState.body}
                    onChange={(e) => setComposeState({ ...composeState, body: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    rows={15}
                    placeholder="Type your message here..."
                  />
                </div>

                {/* AI Instructions Field - available for all modes */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      AI Instructions:
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      {composeState.mode === 'reply'
                        ? 'Tell the AI how to tailor your reply (optional)'
                        : composeState.mode === 'forward'
                        ? 'Tell the AI how to write the forwarding message (optional)'
                        : 'Describe the email you want to write, and AI will generate it for you'}
                    </p>
                    <input
                      type="text"
                      value={composeState.aiInstructions || ''}
                      onChange={(e) => setComposeState({ ...composeState, aiInstructions: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      placeholder={
                        composeState.mode === 'reply'
                          ? "e.g., 'Be more friendly', 'Keep it brief', 'Ask for a meeting'"
                          : composeState.mode === 'forward'
                          ? "e.g., 'Add a brief introduction', 'Highlight key points'"
                          : "e.g., 'Write a meeting request to John', 'Follow up on the invoice'"
                      }
                    />
                  </div>

                  {/* Quick Preset Templates - show different templates based on mode */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Quick templates:
                    </label>
                    {composeState.mode === 'reply' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Professional and concise reply'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Professional
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Friendly and casual tone'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Friendly
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Keep it very brief, just 2-3 sentences'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Brief
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Express gratitude and be enthusiastic'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Grateful
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Propose a meeting or call to discuss further'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Request Meeting
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Ask follow-up questions to clarify details'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Ask Questions
                        </button>
                      </div>
                    )}
                    {composeState.mode === 'forward' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Add a brief note introducing the forwarded email'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          With Introduction
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Highlight the key points from the original email'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Highlight Key Points
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Request action or response from recipient'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Request Action
                        </button>
                      </div>
                    )}
                    {composeState.mode === 'compose' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Write a professional meeting request'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Meeting Request
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Write a follow-up email on a previous conversation'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Follow Up
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Write a thank you email'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Thank You
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Write an inquiry about a product or service'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Inquiry
                        </button>
                        <button
                          onClick={() => setComposeState({
                            ...composeState,
                            aiInstructions: 'Write a proposal or pitch'
                          })}
                          className="px-3 py-1.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                        >
                          Proposal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={handleAIReply}
                disabled={isGeneratingAI}
                className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {composeState.mode === 'reply'
                      ? 'AI Reply'
                      : composeState.mode === 'forward'
                      ? 'AI Write'
                      : 'AI Write'}
                  </>
                )}
              </button>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => setComposeState({ ...composeState, isOpen: false })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {moveFolderState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Move to</h3>
              <button
                onClick={() => setMoveFolderState({ isOpen: false, emailUid: null, selectedFolder: '' })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Destination Folder:
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {Object.keys(folderStates).map((folder) => (
                      <button
                        key={folder}
                        onClick={() => setMoveFolderState({ ...moveFolderState, selectedFolder: folder })}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center gap-3 ${
                          moveFolderState.selectedFolder === folder
                            ? 'bg-primary-50 border-primary-500 text-primary-700'
                            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Folder className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{folder}</span>
                        {moveFolderState.selectedFolder === folder && (
                          <CheckCircle2 className="w-5 h-5 ml-auto text-primary-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setMoveFolderState({ isOpen: false, emailUid: null, selectedFolder: '' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToFolder}
                disabled={!moveFolderState.selectedFolder || movingEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {movingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Moving...
                  </>
                ) : (
                  <>
                    <Folder className="w-4 h-4" />
                    Move
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
