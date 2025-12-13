UI Pattern: "Split-Pane Catalog & Staging"
This design addresses the requirement for an "Industrial-Grade" LIMS workflow. In laboratory settings, speed and accuracy are paramount. Users deal with high volumes of data, so the interface must reduce clicks and memory burden.
Key Architectural Decisions

1. Three-Pane Layout (Context - Choice - Staging)
Instead of using modals (popups) or navigating to new pages, we keep everything on one screen.
Left (Context): The technician never forgets which sample they are working on. Critical info like "Matrix" (e.g., Water vs. Soil) is visible, which helps them decide which test method to pick.
Center (Catalog): A dense but visual grid. We use "Cards" instead of a raw table to make hit-targets easier for touchscreens or fast mouse movements, but keep the typography tight to ensure professional density.
Right (Staging/Cart): This is the most important "Safety" feature. It allows the user to review their selection before committing to the database. It prevents the error of accidentally assigning a test.

2. Visual Hierarchy & Feedback
Selection State: We use a clear blue border and a "Checkmark" icon when a card is selected. This is a binary state (On/Off) that is instantly recognizable.
Categories: Tabs at the top allow for quick filtering (Microbiology vs. Chemistry).
Search: Placed prominently. In a real LIMS with 500+ tests, search is the primary navigation tool.

3. "Industrial" Elements
Monospace Fonts for IDs: Sample IDs and Test Codes (MIC-001) use a monospace font. This prevents ambiguity between characters like 0 and O or 1 and l.
Metadata Density: We show TAT (Turnaround Time) and Price immediately. This helps in decision-making (e.g., choosing a cheaper test if the client is budget-conscious, or a faster test if the sample is "Urgent").
Keyboard Friendly: Ideally, this layout supports tabbing through tests and hitting "Enter" to select, which is crucial for power users.

4. Color Psychology
Slate/Gray Base: Reduces eye strain during long shifts.
Clinical Blue: Used for primary actions and active states. It feels sterile, professional, and trustworthy.
Red/Amber Badges: Used sparingly only for "Urgent" status or warnings to draw attention where it matters.



# **Design Pattern: High-Density LIMS Data Grid**

## **1\. Core Philosophy**

This UI pattern is designed for **High-Throughput Data Entry**. Unlike consumer applications where "delight" and "discovery" are key, a LIMS (Laboratory Information Management System) interface prioritizes:

* **Information Density:** Maximizing the number of visible rows to reduce scrolling.  
* **Rapid Scanning:** Enabling vertical eye movement to find codes fast.  
* **Error Prevention:** separating "Selection" from "Commitment".

## **2\. Anatomy of the Interface**

The layout follows a strict **Left-to-Right** logical flow: **Context \-\> Selection \-\> Review**.

### **A. Context Pane (Left Sidebar)**

* **Purpose:** Anchors the user to the current task. In high-volume labs, technicians switch samples frequently. This pane prevents "Context Switching Errors" (assigning tests to the wrong sample).  
* **Key Elements:**  
  * **Sample ID:** Displayed in a large, monospace font to prevent character confusion (e.g., 0 vs O).  
  * **Matrix:** Visual indicators (color-coded dot) help users instantly recognize sample types (e.g., Water vs. Blood), which dictates which tests are valid.  
  * **Priority Badge:** Prominent placement ensures urgent samples are treated accordingly.

### **B. Data Grid (Center Stage)**

* **Purpose:** The primary workspace for finding and selecting test methods.  
* **Design Choices:**  
  * **Tabular Layout:** Used instead of Cards to allow column-based comparison (e.g., scanning down the "Price" column).  
  * **Sticky Header:** Essential for maintaining context while scrolling through long catalogs.  
  * **Monospace Codes:** The "Test Code" column uses a monospace font for readability and alignment.  
  * **Zebra Striping:** Subtle row coloring (odd:bg-white, even:bg-slate-50) guides the eye across wide rows.  
  * **Explicit Sort Indicators:** Users can sort by Code, Name, Category, TAT, or Price. This is critical for different workflows (e.g., "Find the cheapest test" vs. "Find the fastest test").

### **C. Staging Pane (Right Sidebar)**

* **Purpose:** Acts as a "Shopping Cart" or "Holding Area".  
* **The "Safety Valve" Concept:** \* Clicking a row in the grid **does not** immediately save to the database.  
  * It moves the item to the Staging Pane.  
  * This allows the user to review the *aggregate* impact (Total Cost, Total TAT) before making a commitment.  
* **Interactions:**  
  * **Quick Removal:** 'X' buttons allow rapid correction of mistakes.  
  * **Clear All:** Supports the "Start Over" workflow.

## **3\. User Experience & Interactions**

### **Selection Model**

* **Toggle-based:** Clicking a row selects it; clicking again deselects it.  
* **Visual Feedback:** \* **Row State:** Selected rows turn blue (bg-blue-50) to clearly indicate active status.  
  * **Checkbox:** A distinct icon (CheckSquare vs Square) provides a standard affordance for selection.

### **Search & Filtering**

* **Local Filtering:** The search bar filters the table in real-time (client-side) for instant feedback.  
* **Category Dropdown:** Allows broad segmentation (Microbiology, Chemistry) without reloading the page.

### **Feedback Loop**

* **Save Action:** The "Assign Tests" button shows a loading state (Processing...) to indicate system activity.  
* **Toast Notification:** A non-blocking success message confirms the action was completed, allowing the user to mentally move to the next task.

## **4\. Technical Considerations (React Implementation)**

* **Memoized Filtering:** The processedTests array is wrapped in useMemo. This ensures that typing in the search bar remains snappy even with hundreds of rows, as sorting and filtering logic only runs when dependencies change.  
* **CSS Grid/Flexbox:** The layout uses Flexbox to ensure the Center Pane takes up all available remaining width (flex-1) while sidebars remain fixed width, ensuring responsiveness on different screen sizes.

## **5\. Comparison: Grid View vs. Card View**

| Feature | Data Grid View | Card View |
| :---- | :---- | :---- |
| **Density** | **High** (15+ items/screen) | **Low** (6-9 items/screen) |
| **Scanning** | Vertical (Fast) | Z-Pattern (Slower) |
| **Sorting** | Explicit (Click Headers) | Implicit / Hidden |
| **Touch Targets** | Small (Mouse preferred) | Large (Touch friendly) |
| **Best For** | Power Users, Admin, Bulk Entry | Occasional Users, Tablets |

