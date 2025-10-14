
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