// Mock lesson data for "Loops: Fashion & Python"
// This file provides hardcoded content to test styling before connecting to Supabase

export interface LessonSectionData {
    id: string;
    number: number;
    title: string;
    emoji: string;
    content: string[];
    codeExample?: {
        code: string;
        explanation?: string;
    };
    practice?: {
        id: string;
        instruction: string;
        starterCode: string;
        expectedOutputRegex: string;
        successMessage: string;
    };
}

export const mockLesson = {
    id: "lesson-5",
    title: "Loops: Fashion & Python",
    starterCode: `# Python Fashion Studio
# Ready for your designs...
for i in range(3):
    print("Designing outfit...")`,
    sections: [
        {
            id: "section-1",
            number: 1,
            title: "The Art of Repetition",
            emoji: "🧵",
            content: [
                "Welcome back, designer! If variables are your fabrics and conditionals are your patterns, **loops** are your sewing machine—doing the repetitive work efficiently so you can stay creative.",
            ],
            codeExample: {
                code: `for i in range(5):
    print("Sketching a new design...")`,
                explanation: "A for loop repeats a block of code for each number in a range. Instead of typing the same print statement 5 times, we write:",
            },
            practice: {
                id: "practice-1",
                instruction: "Write a loop to print \"Designing outfit...\" 3 times",
                starterCode: `# Write a loop to print "Designing outfit..." 3 times
for i in range(3):
    print("Designing outfit...")`,
                expectedOutputRegex: "Designing outfit.*Designing outfit.*Designing outfit",
                successMessage: "Beautiful! You've automated the design process.",
            },
        },
        {
            id: "section-2",
            number: 2,
            title: "The Loop Variable (i)",
            emoji: "👕",
            content: [
                "The variable `i` helps the loop track which \"lap\" it's on.",
            ],
            codeExample: {
                code: `for i in range(1, 4):
    print(f"Creating look #{i}")`,
                explanation: "This prints: Look #1, Look #2, Look #3. Perfect for numbering your collection!",
            },
            practice: {
                id: "practice-2",
                instruction: "Print \"Fitting model X\" for numbers 1 to 3",
                starterCode: `# Print "Fitting model X" for numbers 1 to 3
for i in range(1, 4):
    print(f"...")`,
                expectedOutputRegex: "Fitting model.*1.*Fitting model.*2.*Fitting model.*3",
                successMessage: "Models are ready for the runway!",
            },
        },
        {
            id: "section-3",
            number: 3,
            title: "The Wardrobe List",
            emoji: "👠",
            content: [
                "Loops shine when working with collections (lists). It's like flipping through a rack of clothes.",
            ],
            codeExample: {
                code: `tops = ["tank top", "blouse", "sweater"]
for t in tops:
    print(f"Pairing: {t}")`,
                explanation: "Python goes through each item one by one.",
            },
            practice: {
                id: "practice-3",
                instruction: "Loop through shoes list and print \"Shoe: X\"",
                starterCode: `shoes = ["Sneakers", "Heels", "Boots"]
# Loop through and print "Shoe: X"`,
                expectedOutputRegex: "Shoe:.*Sneakers.*Shoe:.*Heels.*Shoe:.*Boots",
                successMessage: "Every shoe has its moment!",
            },
        },
        {
            id: "section-4",
            number: 4,
            title: "The Lookbook (Totals)",
            emoji: "📸",
            content: [
                "You can use loops to count pieces, sum costs, or measure fabric. We call this **accumulation**.",
            ],
            codeExample: {
                code: `costs = [10, 20, 15]
total = 0
for c in costs:
    total = total + c
print(f"Total: {total}")`,
            },
            practice: {
                id: "practice-4",
                instruction: "Calculate total fabric length from lengths list",
                starterCode: `lengths = [2, 3, 1]
total_meters = 0
# Loop to sum the lengths

print(f"Total: {total_meters}")`,
                expectedOutputRegex: "Total:.*6",
                successMessage: "Perfect measurements!",
            },
        },
        {
            id: "section-5",
            number: 5,
            title: "The while Loop",
            emoji: "🔄",
            content: [
                "Use a `while` loop when you want to keep going **until** a condition changes (like \"stitch until finished\").",
            ],
            codeExample: {
                code: `stitches = 0
while stitches < 3:
    print("Adding stitch...")
    stitches += 1`,
            },
            practice: {
                id: "practice-5",
                instruction: "Loop while fit is less than 3, print \"Adjusting...\" and increment",
                starterCode: `fit = 0
# Loop while fit is less than 3
# Print "Adjusting..." and increment fit`,
                expectedOutputRegex: "Adjusting.*Adjusting.*Adjusting",
                successMessage: "Perfect fit achieved!",
            },
        },
    ] as LessonSectionData[],
};
