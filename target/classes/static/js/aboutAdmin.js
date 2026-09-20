document.addEventListener("DOMContentLoaded", () => {

    loadAboutContent();

    document
        .getElementById("saveButton")
        .addEventListener("click", saveAboutContent);

});


// Load latest data from API
async function loadAboutContent(){

    try{

        const response = await fetch("/about");
        if(!response.ok){
            throw new Error("Failed to load about content.");
        }

        const data = await response.json();

        
        if (data.story != null) document.getElementById("story").placeholder = data.story;
        if (data.heading1 != null)document.getElementById("heading1").placeholder = data.heading1;
        if (data.paragraph1 != null) document.getElementById("paragraph1").placeholder = data.paragraph1;
        if (data.heading2 != null) document.getElementById("heading2").placeholder = data.heading2;
        if (data.paragraph2 != null) document.getElementById("paragraph2").placeholder = data.paragraph2;
        if (data.paragraph3 != null) document.getElementById("paragraph3").placeholder = data.paragraph3;

        if (data.specialist1Name != null) document.getElementById("specialist1Name").placeholder = data.specialist1Name;
        if (data.specialist1Position != null) document.getElementById("specialist1Position").placeholder = data.specialist1Position;
        if (data.specialist1Biography != null) document.getElementById("specialist1Biography").placeholder = data.specialist1Biography;

        if (data.specialist2Name != null) document.getElementById("specialist2Name").placeholder = data.specialist2Name;
        if (data.specialist2Position != null) document.getElementById("specialist2Position").placeholder = data.specialist2Position;
        if (data.specialist2Biography != null) document.getElementById("specialist2Biography").placeholder = data.specialist2Biography;

       



    }
    catch(error){

        console.log(error);

    }


}


// Save changes
async function saveAboutContent(){

    


  

//story data sender to backend


    await fetch("/about/story",{

        method:"PUT",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify( document.getElementById("story").value)

    });






//heading 1 data sender to backend
    

    await fetch("/about/heading1",{

        method:"PUT",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify(document.getElementById("heading1").value)

    });


// 
//heading 2 data sender to backend


await fetch("/about/heading2",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("heading2").value)

});


//paragraph 1 data sender to backend


await fetch("/about/paragraph1",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("paragraph1").value)

});



//paragraph 2 data sender to backend


await fetch("/about/paragraph2",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("paragraph2").value)

});

//paragraph 3 data sender to backend


await fetch("/about/paragraph3",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("paragraph3").value)

});

//specialist1 data sender to backend


await fetch("/about/specialist1Name",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("specialist1Name").value)

});

//specialist2 name data sender to backend


await fetch("/about/specialist2Name",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("specialist2Name").value)

});


//specialist2 position data sender to backend


await fetch("/about/specialist2Position",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("specialist2Position").value)

});

//specialist1 position data sender to backend


await fetch("/about/specialist1Position",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify( document.getElementById("specialist1Position").value)

});

//specialist1 biography data sender to backend


await fetch("/about/specialist1Biography",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("specialist1Biography").value)

});

await fetch("/about/specialist2Biography",{

    method:"PUT",

    headers:{
        "Content-Type":"application/json"
    },

    body:JSON.stringify(document.getElementById("specialist2Biography").value)

});








    alert("Content updated.");

    loadAboutContent();

}

