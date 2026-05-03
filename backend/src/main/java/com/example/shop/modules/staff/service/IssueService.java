package com.example.shop.modules.staff.service;

import com.example.shop.modules.staff.dto.IssueDto;
import com.example.shop.modules.staff.dto.RespondIssueRequest;

import java.util.List;

public interface IssueService {
    List<IssueDto> listIssues(String status);
    IssueDto respondToIssueLog(Long id, RespondIssueRequest request, String responder);
    IssueDto respondToHelpRequest(Long id, RespondIssueRequest request, String responder);
}
