import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from 'zod';

// Define Zod schema for request body validation
const requestBodySchema = z.object({
  text: z.string({ required_error: "Transcript text is required." }).min(1, "Transcript text cannot be empty."),
  participants: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const validationResult = requestBodySchema.safeParse(rawBody);

    if (!validationResult.success) {
      return Response.json({ error: "Invalid request body", details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }
    const { text, participants } = validationResult.data;

    const participantInfo =
      participants && participants.length > 0
        ? `This meeting included ${participants.length} participants: ${participants.join(", ")}.`
        : "No specific participants were identified for this meeting.";

    const newPrompt = `
You are an expert meeting assistant. Your task is to create a comprehensive yet concise Markdown summary of the provided meeting transcript.

${participantInfo}

Here is the meeting transcript:
${text}

Please structure your summary as follows, using Markdown:

### [Relevant Topic 1 Heading]
- Key point about topic 1
- Another key point about topic 1

### [Relevant Topic 2 Heading]
- Key point about topic 2

... (Use H3 headings for each distinct major topic discussed. Aim for clarity and conciseness.)

### Action Items
- [Action Item 1: Assigned to (if specified), Due by (if specified)]
- [Action Item 2: ...]
- (If no action items, state "No specific action items were identified.")

**Important Formatting Instructions:**
- Use H3 (###) for all section titles.
- Use bullet points (-) for lists under each section.
- Ensure the output is clean, well-formatted Markdown.
- If the meeting content strongly aligns with a structure discussing methodology, findings, planned improvements, and future directions (e.g., for a project update or research discussion), you MAY use these specific headings if they are highly relevant:
    ### GitHub Log Analysis Methodology
    ### Current Findings
    ### Planned Improvements
    ### Future Directions
  Otherwise, derive suitable H3 headings based on the main topics of the transcript.
- **Always include the "### Action Items" section.**

Do NOT output JSON. Output only the Markdown summary.
`;

    const { text: generatedMarkdown } = await generateText({
      model: google("gemini-2.5-flash-preview-05-20", {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY, 
      }),
      prompt: newPrompt,
    });

    let cleanedMarkdown = generatedMarkdown.trim();

    if (cleanedMarkdown.startsWith("```markdown")) {
      cleanedMarkdown = cleanedMarkdown.replace(/^```markdown\s*/, "").replace(/\s*```$/, "");
    } else if (cleanedMarkdown.startsWith("```")) {
      cleanedMarkdown = cleanedMarkdown.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    cleanedMarkdown = cleanedMarkdown.trim();

    // Prefix with a plain "Summary" heading so copied text matches the desired
    // format while still rendering nicely in Markdown.
    const finalMarkdown = `Summary\n\n${cleanedMarkdown}`;

    return Response.json({ markdownSummary: finalMarkdown });

  } catch (error) {
    console.error("Error generating summary:", error);
    let errorMessage = "Failed to generate summary";
    let errorDetails = "Unknown error";
    if (error instanceof Error) {
      errorDetails = error.message;
    }

    return Response.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 },
    );
  }
}
