class ChatHandler {
    constructor(webSocketHandler, webRTCHandler) {
        this.webSocketHandler = webSocketHandler;
        this.webRTCHandler = webRTCHandler;
        this.messageContainer = document.getElementById("messageContainer");
        this.inputField = document.querySelector(".chatInputWrapper input");
        this.sendButton = document.getElementById("sendChat");
        this.fileInput = document.getElementById("fileInput");

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.sendButton.addEventListener("click", () => this.sendMessage());
        this.fileInput.addEventListener("change", () => this.sendFile());
    }

    sendMessage() {
        const message = this.inputField.value.trim();
        if (message !== "") {
            this.webSocketHandler.sendChatMessage(this.webRTCHandler.roomId, message);
            this.displayChatMessage(message, "local");
            this.inputField.value = ""; // Clear input
        }
    }

    sendFile() {
        const file = this.fileInput.files[0]; // Get the selected file
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const fileData = {
                name: file.name,
                type: file.type,
                size: file.size,
                content: reader.result // Base64 encoded file
            };

            this.webSocketHandler.sendFileMessage(this.webRTCHandler.roomId, fileData);
            this.displayFileMessage(fileData, "local");
        };

        reader.readAsDataURL(file); // Convert file to Base64
    }

    displayChatMessage(message, sender) {
        const messageRow = document.createElement("div");
        messageRow.classList.add("messageRow", sender === "local" ? "right" : "left");

        messageRow.innerHTML = `
            <div class="chat-headers">
                <span class="senderName">${sender === "local" ? "You" : "Participant"}</span>
            </div>
            <div class="msg-time">
                <div class="messageContent">
                    <div class="messageText">${message}</div>
                </div>
                <span class="messageTime">${new Date().toLocaleTimeString()}</span>
            </div>
        `;
        this.messageContainer.appendChild(messageRow);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    displayFileMessage(fileData, sender) {
        const messageRow = document.createElement("div");
        messageRow.classList.add("messageRow", sender === "local" ? "right" : "left");

        let filePreview;
        if (fileData.type.startsWith("image/")) {
            filePreview = `<img src="${fileData.content}" alt="${fileData.name}" class="filePreview">`;
        } else {
            filePreview = `<a href="${fileData.content}" download="${fileData.name}" class="fileDownload">${fileData.name}</a>`;
        }

        messageRow.innerHTML = `
            <div class="chat-headers">
                <span class="senderName">${sender === "local" ? "You" : "Participant"}</span>
            </div>
            <div class="msg-time">
                <div class="messageContent">${filePreview}</div>
                <span class="messageTime">${new Date().toLocaleTimeString()}</span>
            </div>
        `;
        this.messageContainer.appendChild(messageRow);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
}
export default ChatHandler;