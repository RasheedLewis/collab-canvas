
---

# **PRD: CollabCanvas MVP**
**Version:** 1.0
**Date:** [Current Date]
**Status:** In Development
**Goal:** To build a solid, real-time collaborative canvas foundation within 24 hours.

---

## **1. Vision & Goal**

To create the foundational infrastructure for a real-time collaborative design tool. The MVP's success is not measured by feature richness, but by the robustness and reliability of its multiplayer synchronization, proving that the core architecture can support future AI and complex feature integrations.

> **MVP Mantra:** A simple canvas with bulletproof multiplayer is worth more than a feature-rich canvas with broken sync.

---

## **2. MVP Scope & Requirements**

This is a hard gate. The following features **must** be implemented, deployed, and publicly accessible to pass the MVP checkpoint.

### **Core Canvas & Objects**
- **Pan & Zoom:** A large workspace with smooth panning and zooming capabilities.
- **Basic Shapes:** Support for all three core shape types:
  - **Rectangles:** Solid fill with configurable color
  - **Circles:** Solid fill with configurable color  
  - **Text Objects:** Editable text with font size and color options
- **Canvas Workspace:** Infinite canvas (minimum 10,000 x 10,000px) with smooth performance
- **Object Manipulation:** Users must be able to **create** and **move** objects on the canvas.

### **Real-Time Collaboration**
- **Multiplayer Sync:** Real-time synchronization of all canvas objects between **2 or more concurrent users**.
- **Multiplayer Cursors:** All users see each other's cursors moving in real time, with name labels.
- **Rich Presence Awareness:** 
  - **User avatars** and names displayed in top toolbar
  - **Live cursors** with user names and colors
  - **Active tool indicators** showing what each user is currently using
  - **Online status** with join/leave notifications

### **User & Data Management**
- **Dual Authentication System:**
  - **Google OAuth** for quick social login
  - **Email/Password** registration for users preferring traditional auth
  - **User profiles** with customizable display names and avatar colors
- **State Persistence:** The canvas state must persist. If all users leave and return, their work is restored.

### **Deployment**
- The application must be **deployed and publicly accessible** for testing.

---

## **3. Out of Scope for MVP**

The following are explicitly **excluded** from the MVP to maintain focus:
- Resizing or rotating objects.
- Advanced selection (e.g., multi-select, drag-select).
- Layer management.
- The AI Canvas Agent.
- Any advanced styling (gradients, borders, etc.). Solid colors only.

---

## **4. User Stories**

| As a... | I want to... | So that... |
| :--- | :--- | :--- |
| **New User** | sign up / log in with my account | my work is saved and I have an identity in the session. |
| **Designer** | pan and zoom around a large canvas | I can work on different areas of my design. |
| **Designer** | create basic shapes (rectangles, circles, text) | I can start building the visual elements of my design. |
| **Designer** | move the shapes I've created | I can arrange the layout of my design. |
| **Collaborator** | see the cursors and names of other users in real-time | I am aware of who is working and where they are focused. |
| **Collaborator** | see shapes created and moved by others instantly | we can work on the same canvas simultaneously without conflicts. |
| **Returning User** | open the canvas and see all my previous work | my progress is not lost between sessions. |

---

## **5. Technical Architecture**

### **Definitive Tech Stack**

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18 with TypeScript |
| **Canvas Library** | Konva.js |
| **State Management** | Zustand |
| **Backend/Realtime DB** | Firebase (Firestore + Auth) |
| **Deployment** | Vercel |

### **System Architecture (Minimum)**

1.  **Frontend Client:**
    *   Renders the canvas and handles user input (mouse, keyboard).
    *   Listens for remote updates from the backend.
    *   Sends local user actions (object create/move, cursor movement) to the backend.

2.  **Backend Service & Realtime Database (e.g., Firestore):**
    *   **Broadcasts Updates:** Listens for client updates and broadcasts them to all other connected clients in real-time.
    *   **Manages Presence:** Tracks which users are online.
    *   **Conflict Resolution:** Implements a comprehensive strategy (see below).

3.  **Persistence Layer:**
    *   The Realtime DB (e.g., Firestore) acts as the persistence layer, saving the current canvas state so it survives disconnects and server restarts.

### **Conflict Resolution Strategy**
- **Object-Level Conflicts:** Last Write Wins for object creation/deletion
- **Property-Level Conflicts:** Last Write Wins for individual properties (position, color, text content)
- **Optimistic Updates:** Local changes apply immediately, with server reconciliation
- **Conflict Indicators:** Brief visual feedback when conflicts are resolved

---

## **6. Testing & Acceptance Criteria**

We will test the MVP with the following scenarios:

| Test Scenario | Expected Outcome |
| :--- | :--- |
| **Two users editing simultaneously** in different browsers/windows. | All object creations, movements, and cursor positions are synchronized instantly (<100ms for objects, <50ms for cursors) between both clients. |
| **One user refreshes the page** mid-edit. | The user reconnects and sees the current canvas state, including all changes made by themselves and others during their disconnect. |
| **Multiple shapes are created and moved rapidly.** | The application maintains **60 FPS** during interactions. Sync remains stable without objects "jittering" or losing state. |
| **Authentication flow testing** with both Google OAuth and email/password. | Both authentication methods work seamlessly, users maintain identity across sessions. |
| **Conflict resolution under stress** - two users rapidly editing the same object. | System resolves conflicts gracefully with Last Write Wins, no data corruption. |
| **Rich presence features** - users joining/leaving, tool switching. | All presence indicators update in real-time, cursors and tool states sync accurately. |

---

## **7. Success Metrics (KPIs)**

*   **Performance:** Maintain 60 FPS during pan, zoom, and object manipulation.
*   **Sync Latency:** Object changes sync in <100ms; cursor positions in <50ms.
*   **Reliability:** Zero data loss during disconnects/reconnects. No persistent merge conflicts.
*   **Stability:** Supports 5+ concurrent users without significant performance degradation.

---

## **8. Build Strategy & Timeline (24-Hour Sprint)**

1.  **Hour 0-6: Foundation & Authentication**
    *   Set up project with React/TypeScript + Konva.js + Firebase.
    *   Implement basic canvas with pan/zoom.
    *   Implement dual authentication (Google OAuth + Email/Password).
    *   Set up user profiles and avatar system.

2.  **Hour 6-14: The Hard Part - Multiplayer Sync**
    *   Implement real-time cursor sync with name labels and colors.
    *   Implement real-time sync for rectangle creation and movement.
    *   Implement comprehensive presence awareness (avatars, tool indicators).
    *   Build conflict resolution system.

3.  **Hour 14-20: All Shapes & Enhanced Features**
    *   Add circle and text object support with real-time sync.
    *   Implement rich presence features (join/leave notifications).
    *   Ensure state persistence across all object types.
    *   Performance optimization for 60 FPS target.

4.  **Hour 20-24: Deployment & Comprehensive Testing**
    *   Deploy to Vercel with Firebase backend.
    *   Rigorously test all acceptance criteria with multiple browsers and users.
    *   Test authentication flows, conflict resolution, and presence features.
    *   Fix critical bugs and performance issues.

> **Warning:** Multiplayer sync is the hardest part. Build it first. Avoid the temptation to add extra features until the core collaboration is solid.

---

## **9. Post-MVP Feature: AI Canvas Agent**

**Status:** Planned for Phase 2  
**Priority:** High  
**Goal:** Build an AI agent that manipulates the canvas through natural language using OpenAI function calling.

### **Feature Overview**

The AI Canvas Agent allows users to create, manipulate, and arrange canvas objects using natural language commands. When a user types "Create a blue rectangle in the center," the AI agent calls canvas API functions, and the rectangle appears on everyone's canvas via real-time sync.

### **Required Capabilities**

- **6+ Distinct Command Types:** Creation, manipulation, layout, and complex operations
- **Real-time Sync:** All AI-generated content syncs across all users
- **Natural Language Processing:** Handle conversational requests with context
- **Multi-step Operations:** Execute complex commands like "create a login form"
- **Performance Target:** <2 seconds response time for single-step commands

### **Implementation Subtasks**

#### **Phase 1: Core AI Infrastructure (8-12 hours)**

**1.1 OpenAI Integration Setup**
- [ ] Install and configure OpenAI SDK in backend
- [ ] Set up environment variables for OpenAI API key
- [ ] Create OpenAI client service with error handling
- [ ] Implement rate limiting and cost monitoring
- [ ] Add request/response logging for debugging

**1.2 AI Tool Schema Implementation**
- [ ] Create `ai-tools.json` schema file (✅ Complete)
- [ ] Implement tool validation system
- [ ] Create tool registry for dynamic loading
- [ ] Add tool versioning support
- [ ] Document tool usage patterns

**1.3 Backend API Endpoints**
- [ ] Create `/api/ai/chat` endpoint for AI conversations
- [ ] Implement `/api/ai/execute-tool` endpoint for function calls
- [ ] Add `/api/ai/canvas-context` endpoint for current state
- [ ] Create middleware for AI request authentication
- [ ] Add request queuing for concurrent AI operations

#### **Phase 2: Canvas Tool Implementation (12-16 hours)**

**2.1 Core Creation Tools**
- [ ] Implement `createRectangle` function with WebSocket sync
- [ ] Implement `createCircle` function with WebSocket sync  
- [ ] Implement `createText` function with WebSocket sync
- [ ] Add input validation for all creation parameters
- [ ] Test creation tools with real-time synchronization

**2.2 Manipulation Tools**
- [ ] Implement `moveObject` function
- [ ] Implement `resizeObject` function
- [ ] Implement `rotateObject` function
- [ ] Implement `deleteObject` function
- [ ] Add object existence validation

**2.3 Query & Context Tools**
- [ ] Implement `getCanvasState` function
- [ ] Implement `findObjects` search function
- [ ] Implement `getCanvasBounds` function
- [ ] Add canvas coordinate system helpers
- [ ] Create object filtering utilities

**2.4 Layout & Arrangement Tools**
- [ ] Implement `arrangeObjectsInRow` function
- [ ] Implement `arrangeObjectsInGrid` function
- [ ] Implement `alignObjects` function
- [ ] Implement `distributeObjects` function
- [ ] Add collision detection for layout operations

#### **Phase 3: Complex Operations (8-10 hours)**

**3.1 Complex Creation Tools**
- [ ] Implement `createForm` with multiple field types
- [ ] Implement `createNavigation` with menu items
- [ ] Implement `createCard` with structured layout
- [ ] Implement `createShapePattern` for grids/patterns
- [ ] Add template system for complex objects

**3.2 Advanced Canvas Management**
- [ ] Implement `clearCanvas` function (✅ Complete)
- [ ] Implement `groupObjects` function
- [ ] Implement `copyObjects` function
- [ ] Add undo/redo support for AI operations
- [ ] Create batch operation support

#### **Phase 4: Frontend AI Interface (6-8 hours)**

**4.1 AI Chat Component**
- [ ] Create `AIChat` React component
- [ ] Implement chat message history
- [ ] Add typing indicators and loading states
- [ ] Create message formatting for commands/results
- [ ] Add voice input support (optional)

**4.2 AI Toolbar Integration**
- [ ] Add AI chat toggle button to toolbar
- [ ] Create floating AI assistant panel
- [ ] Implement AI suggestion prompts
- [ ] Add quick command buttons for common operations
- [ ] Create AI command history

**4.3 Visual Feedback System**
- [ ] Add progress indicators for AI operations
- [ ] Implement object highlighting for AI-created items
- [ ] Create visual confirmation for AI commands
- [ ] Add error handling with user-friendly messages
- [ ] Implement AI operation preview mode

#### **Phase 5: Advanced AI Features (4-6 hours)**

**5.1 Context Awareness**
- [ ] Implement canvas state analysis for AI context
- [ ] Add object relationship understanding
- [ ] Create spatial awareness for positioning
- [ ] Implement color palette suggestions
- [ ] Add design pattern recognition

**5.2 Multi-step Operations**
- [ ] Create operation planning system
- [ ] Implement step-by-step execution
- [ ] Add operation rollback capabilities
- [ ] Create confirmation dialogs for complex operations
- [ ] Add progress tracking for multi-step commands

**5.3 Collaborative AI Features**
- [ ] Implement AI request queuing for multiple users
- [ ] Add AI operation attribution (who requested what)
- [ ] Create AI operation conflict resolution
- [ ] Implement shared AI conversation history
- [ ] Add AI operation permissions system

#### **Phase 6: Testing & Optimization (4-6 hours)**

**6.1 Comprehensive Testing**
- [ ] Test all 21 AI tool functions individually
- [ ] Test complex multi-step operations
- [ ] Validate real-time sync for AI-generated content
- [ ] Test concurrent AI operations by multiple users
- [ ] Performance testing for response times

**6.2 Error Handling & Resilience**
- [ ] Implement comprehensive error handling
- [ ] Add fallback mechanisms for API failures
- [ ] Create retry logic for failed operations
- [ ] Add user feedback for partial failures
- [ ] Implement graceful degradation

**6.3 Documentation & Examples**
- [ ] Create AI command documentation
- [ ] Add example prompts and expected outcomes
- [ ] Create developer API documentation
- [ ] Add troubleshooting guide
- [ ] Create user tutorial/onboarding

### **Acceptance Criteria**

| Test Scenario | Expected Outcome |
| :--- | :--- |
| **"Create a blue rectangle at 100, 200"** | Rectangle appears at exact coordinates with blue fill, syncs to all users |
| **"Create a login form"** | Form with username, password, and submit button appears, properly aligned |
| **"Arrange these shapes in a 3x3 grid"** | Selected objects arrange in perfect 3x3 grid with equal spacing |
| **"Move the blue rectangle to the center"** | AI identifies blue rectangle, calculates center, moves object smoothly |
| **Complex multi-user scenario** | Multiple users can use AI simultaneously without conflicts |
| **Performance under load** | AI responds within 2 seconds for simple commands, 5 seconds for complex |

### **Success Metrics**

- **Latency:** <2s for single-step commands, <5s for complex operations
- **Breadth:** Successfully handles 6+ distinct command types
- **Accuracy:** 95%+ success rate for well-formed natural language commands
- **Sync Reliability:** 100% real-time sync for AI-generated content
- **User Adoption:** Natural language interface reduces learning curve

### **Technical Dependencies**

- ✅ WebSocket real-time synchronization (MVP complete)
- ✅ Canvas object manipulation system (MVP complete)
- ✅ User authentication and permissions (MVP complete)
- ⏳ OpenAI API integration (Phase 1)
- ⏳ Backend API expansion (Phase 2)
- ⏳ Frontend AI interface (Phase 4)

### **Risk Mitigation**

- **OpenAI API Rate Limits:** Implement request queuing and user limits
- **Cost Management:** Add usage monitoring and budget alerts
- **Latency Issues:** Implement caching and optimistic UI updates
- **Complex Command Parsing:** Start with simple commands, expand gradually
- **Multi-user Conflicts:** Leverage existing conflict resolution system

---

## **10. Post-MVP Feature: Multi-Canvas Workspace Management**

**Status:** Planned for Phase 3  
**Priority:** High  
**Goal:** Allow users to create, manage, and share multiple separate canvas workspaces with granular permissions.

### **Feature Overview**

Users can create multiple independent canvases (workspaces/rooms), each with its own collaborative space, object state, and user permissions. This transforms the application from a single shared canvas to a comprehensive workspace management system where users can organize different projects and control access.

### **Required Capabilities**

- **Canvas Creation & Management:** Users can create new canvases, name them, and organize projects
- **Sharing & Permissions:** Canvas owners can invite collaborators with different access levels (owner, editor, viewer)
- **Canvas Discovery:** Users can browse their own canvases and canvases shared with them
- **Real-time Navigation:** Switch between canvases without losing connection or disrupting other users
- **Canvas Metadata:** Rich information including creation date, last modified, collaborator count, preview thumbnails

### **User Stories**

| As a... | I want to... | So that... |
| :--- | :--- | :--- |
| **Project Manager** | create separate canvases for different projects | I can organize work and avoid mixing content between projects |
| **Canvas Owner** | invite specific collaborators to my canvas | I can control who has access to sensitive or private work |
| **Collaborator** | see all canvases I have access to in a dashboard | I can easily navigate between different projects |
| **Team Lead** | set different permission levels for team members | I can give appropriate access (view-only vs. editing) based on roles |
| **Designer** | create a private canvas for sketching | I can work on ideas privately before sharing with the team |
| **User** | see live previews/thumbnails of my canvases | I can quickly identify and switch to the right canvas |

### **Technical Requirements**

- **Canvas Data Model:** Each canvas is an independent entity with unique ID, metadata, and isolated object state
- **Permission System:** Role-based access control (Owner, Editor, Viewer) with granular permissions
- **Sharing Mechanisms:** Invite by email, shareable links, and public canvas options
- **Canvas Dashboard:** Responsive interface showing user's canvases with sorting, filtering, and search
- **Real-time Updates:** Canvas list updates in real-time when new canvases are shared or permissions change
- **Performance:** Canvas switching should be near-instantaneous (<500ms) with proper state management