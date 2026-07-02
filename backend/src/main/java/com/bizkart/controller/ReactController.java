package com.bizkart.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class ReactController {

    @RequestMapping(value = {
            "/",
            "/{path:[^\\.]*}"
    })
    public String redirect() {
        return "forward:/index.html";
    }
}